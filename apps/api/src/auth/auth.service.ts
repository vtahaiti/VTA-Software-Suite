import { ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuditAction, TenantStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityService } from "../security/security.service";
import { defaultPermissions } from "../rbac/default-permissions";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { isPasswordStrong, passwordPolicyMessage } from "./password-policy";
import type { AuthUser } from "./types/auth-user";

const accessTokenTtl = "15m";
const refreshTokenTtl = "1d";
const rememberMeRefreshTokenTtl = "30d";
const adminEmail = "admin@vta.ht";
const adminPassword = "admin123";
const demoPasswordHash = bcrypt.hashSync(adminPassword, 12);
const demoUser = {
  id: "usr_admin_vta",
  tenantId: "tenant_vta",
  tenant: "VTA Enterprise",
  name: "Administrateur VTA",
  email: adminEmail,
  role: "Owner",
  roles: ["Owner"],
  permissions: defaultPermissions.map((permission) => permission.key),
  createdAt: "2026-07-06T00:00:00.000Z"
};
const passwordResetMessage = "Si cette adresse email est associ\u00e9e \u00e0 un compte, vous recevrez les instructions de r\u00e9initialisation.";
const passwordResetTokenTtlMinutes = 30;
const passwordResetRateLimitWindowMs = 15 * 60 * 1000;
const passwordResetMaxAttempts = 5;

type SessionRecord = { user: AuthUser; refreshTokenHash: string; rememberMe: boolean; expiresAt: Date; audience: "tenant" | "platform" };
type AuthRoleEntry = string | { role?: { name?: string; permissions?: Array<{ permission?: { key?: string } }> } };
type AuthUserRecord = { id: string; tenantId: string; tenant?: { name?: string } | string | null; name: string; email: string; role?: string; roles?: AuthRoleEntry[]; createdAt?: Date | string };
type AuditUserRecord = { id?: string; tenantId?: string; tenant?: { name?: string } | string | null; name?: string; email?: string };

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly passwordResetAttempts = new Map<string, { count: number; resetAt: number }>();
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly auditLogs: AuditLogsService,
    private readonly emailService: EmailService
  ) {}

  async login(loginDto: LoginDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
    const email = loginDto.email.trim().toLowerCase();
    if (await this.security.isBlocked(email)) {
      await this.security.recordBlockedLogin(email, meta);
      await this.recordAuthAudit(AuditAction.LOGIN_FAILED, null, email, meta, "Connexion bloquee apres plusieurs echecs");
      throw new UnauthorizedException("Compte temporairement bloque apres plusieurs echecs. Reessayez plus tard.");
    }

    let user = await this.findUserByEmail(email);
    user ??= await this.ensureConfiguredSuperAdmin(email, loginDto.password);
    if (!user) {
      const passwordMatchesDemo = await bcrypt.compare(loginDto.password, demoPasswordHash);
      if (email !== adminEmail || !passwordMatchesDemo) {
        await this.security.recordLoginFailure(email, meta);
        await this.recordAuthAudit(AuditAction.LOGIN_FAILED, null, email, meta, "Connexion echouee");
        throw new UnauthorizedException("Email ou mot de passe incorrect");
      }
      const authUser = this.toAuthUser(demoUser);
      const session = await this.createSession(authUser, Boolean(loginDto.rememberMe), "tenant");
      await this.security.recordLoginSuccess(authUser, meta);
      await this.recordAuthAudit(AuditAction.LOGIN, authUser, authUser.email, meta, "Connexion reussie");
      return session;
    }

    if (user.isActive === false) {
      await this.security.recordLoginFailure(email, meta);
      await this.recordAuthAudit(AuditAction.LOGIN_FAILED, user, email, meta, "Compte utilisateur desactive");
      throw new UnauthorizedException("Compte utilisateur desactive. Contactez votre administrateur.");
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordMatches) {
      await this.security.recordLoginFailure(email, meta);
      await this.recordAuthAudit(AuditAction.LOGIN_FAILED, user, email, meta, "Connexion echouee");
      throw new UnauthorizedException("Email ou mot de passe incorrect");
    }
    const authUser = this.toAuthUser(user);
    await this.assertTenantCanLogin(authUser);
    await this.touchTenantLogin(authUser.tenantId);
    const session = await this.createSession(authUser, Boolean(loginDto.rememberMe), "tenant");
    await this.security.recordLoginSuccess(authUser, meta);
    await this.recordAuthAudit(AuditAction.LOGIN, authUser, authUser.email, meta, "Connexion reussie");
    return session;
  }

  async loginPlatformAdmin(loginDto: LoginDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
    const email = loginDto.email.trim().toLowerCase();
    let user = await this.findUserByEmail(email);
    user ??= await this.ensureConfiguredSuperAdmin(email, loginDto.password);

    if (!user || user.isActive === false) {
      await this.security.recordLoginFailure(email, meta);
      await this.recordAuthAudit(AuditAction.LOGIN_FAILED, null, email, meta, "Connexion plateforme refusee");
      throw new UnauthorizedException("Email ou mot de passe incorrect");
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordMatches) {
      await this.security.recordLoginFailure(email, meta);
      await this.recordAuthAudit(AuditAction.LOGIN_FAILED, user, email, meta, "Connexion plateforme echouee");
      throw new UnauthorizedException("Email ou mot de passe incorrect");
    }

    const authUser = this.toAuthUser(user);
    if (!this.isPlatformAdmin(authUser)) {
      await this.security.recordLoginFailure(email, meta);
      await this.recordAuthAudit(AuditAction.LOGIN_FAILED, user, email, meta, "Connexion plateforme refusee: role insuffisant");
      throw new ForbiddenException("Acces reserve au SUPER_ADMIN VTA");
    }

    const session = await this.createSession(authUser, Boolean(loginDto.rememberMe), "platform");
    await this.security.recordLoginSuccess(authUser, meta);
    await this.recordAuthAudit(AuditAction.LOGIN, authUser, authUser.email, meta, "Connexion plateforme reussie");
    return session;
  }

  async requestPasswordReset(dto: ForgotPasswordDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
    const requestId = randomUUID();
    const email = dto.email.trim().toLowerCase();

    if (!this.canRequestPasswordReset(email, meta.ipAddress)) {
      this.logger.warn({ event: "password_reset_request", status: "rate_limited", requestId, ipAddress: meta.ipAddress });
      return { message: passwordResetMessage };
    }

    const user = await this.findUserByEmail(email);

    if (!user) {
      this.logger.log({ event: "password_reset_request", status: "neutral_no_account_match", requestId });
      return { message: passwordResetMessage };
    }

    const rawToken = randomBytes(32).toString("base64url");
    const resetUrl = this.buildPasswordResetUrl(rawToken);

    if (!resetUrl) {
      this.logger.error({ event: "password_reset_request", status: "invalid_reset_url", requestId });
      return { message: passwordResetMessage };
    }

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashPasswordResetToken(rawToken),
          expiresAt: new Date(Date.now() + passwordResetTokenTtlMinutes * 60 * 1000)
        }
      })
    ]);

    const result = await this.emailService.sendPasswordResetEmail({
      tenantId: user.tenantId,
      userId: user.id,
      to: user.email,
      userName: user.name,
      resetUrl,
      requestId,
      expiresInMinutes: passwordResetTokenTtlMinutes
    });

    this.logger.log({
      event: "password_reset_request",
      provider: result.provider,
      status: result.status,
      accepted: result.accepted,
      messageId: result.messageId,
      requestId
    });

    return { message: passwordResetMessage };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new UnauthorizedException("Les mots de passe ne correspondent pas.");
    }
    if (!isPasswordStrong(dto.password)) {
      throw new UnauthorizedException(passwordPolicyMessage);
    }

    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: this.hashPasswordResetToken(dto.token),
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!token || token.user.isActive === false) {
      throw new UnauthorizedException("Lien de r\u00e9initialisation invalide ou expir\u00e9.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: token.userId }, data: { password: await bcrypt.hash(dto.password, 12) } }),
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: token.userId, usedAt: null, id: { not: token.id } },
        data: { usedAt: new Date() }
      })
    ]);

    this.invalidateUserSessions(token.userId);

    await this.emailService.sendPasswordChangedEmail({
      tenantId: token.user.tenantId,
      userId: token.userId,
      to: token.user.email,
      userName: token.user.name
    }).catch(() => undefined);

    return { message: "Mot de passe r\u00e9initialis\u00e9. Vous pouvez maintenant vous connecter." };
  }


  async issueSessionForUser(userId: string, rememberMe = true) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
    });
    if (!user) throw new UnauthorizedException("Utilisateur introuvable");
    return this.createSession(this.toAuthUser(user), rememberMe, "tenant");
  }
  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = this.sessions.get(payload.sessionId);
    if (!session || session.expiresAt.getTime() < Date.now()) throw new UnauthorizedException("Session expiree");
    await this.assertUserActive(session.user.id);
    const tokenMatches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!tokenMatches) {
      this.sessions.delete(payload.sessionId);
      throw new UnauthorizedException("Session invalide");
    }
    this.sessions.delete(payload.sessionId);
    if (session.audience !== "tenant") throw new UnauthorizedException("Session invalide");
    return this.createSession(session.user, session.rememberMe, "tenant");
  }

  async refreshPlatform(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = this.sessions.get(payload.sessionId);
    if (!session || session.expiresAt.getTime() < Date.now() || session.audience !== "platform") throw new UnauthorizedException("Session plateforme expiree");
    await this.assertUserActive(session.user.id);
    const tokenMatches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!tokenMatches) {
      this.sessions.delete(payload.sessionId);
      throw new UnauthorizedException("Session plateforme invalide");
    }
    this.sessions.delete(payload.sessionId);
    return this.createSession(session.user, session.rememberMe, "platform");
  }

  async logout(sessionId: string, user?: AuthUser, meta: { ipAddress?: string; userAgent?: string } = {}) {
    this.sessions.delete(sessionId);
    if (user) {
      await this.security.recordLogout(user, meta);
      await this.recordAuthAudit(AuditAction.LOGOUT, user, user.email, meta, "Deconnexion securisee");
    }
  }

  async verifyAccessToken(accessToken: string): Promise<AuthUser> {
    let payload: AuthUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthUser>(accessToken, { secret: this.accessTokenSecret });
    } catch {
      throw new UnauthorizedException("Token invalide");
    }
    if (!this.sessions.has(payload.sessionId)) throw new UnauthorizedException("Session invalide");
    const session = this.sessions.get(payload.sessionId);
    if (!session || payload.audience !== session.audience) throw new UnauthorizedException("Audience invalide");
    if (payload.iss !== this.tokenIssuer) throw new UnauthorizedException("Emetteur invalide");
    await this.assertUserActive(payload.id);
    await this.assertTenantCanRequest(payload);
    await this.touchTenantSeen(payload.tenantId);
    return payload;
  }

  private async findUserByEmail(email: string) {
    try {
      return await this.prisma.user.findFirst({
        where: { email },
        include: { tenant: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
      });
    } catch {
      return null;
    }
  }

  private toAuthUser(user: AuthUserRecord): AuthUser {
    const roles = user.roles?.map((entry) => typeof entry === "string" ? entry : entry.role?.name).filter((role): role is string => Boolean(role)) ?? ["Owner"];
    const permissions = user.roles?.flatMap((entry) => typeof entry === "string" ? [] : entry.role?.permissions?.map((rolePermission) => rolePermission.permission?.key).filter((key): key is string => Boolean(key)) ?? []) ?? defaultPermissions.map((permission) => permission.key);
    const tenantName = typeof user.tenant === "object" ? user.tenant?.name : user.tenant;
    return {
      id: user.id,
      sessionId: "",
      tenantId: user.tenantId,
      tenant: tenantName ?? "VTA Enterprise",
      name: user.name,
      email: user.email,
      role: roles[0] ?? "Owner",
      roles,
      permissions: permissions.length ? [...new Set(permissions)] : defaultPermissions.map((permission) => permission.key),
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt ?? new Date().toISOString()
    };
  }

  private async createSession(baseUser: AuthUser, rememberMe: boolean, audience: "tenant" | "platform") {
    const sessionId = randomUUID();
    const user: AuthUser = { ...baseUser, sessionId, audience };
    const accessToken = await this.jwtService.signAsync(user, { secret: this.accessTokenSecret, expiresIn: accessTokenTtl, audience, issuer: this.tokenIssuer });
    const refreshToken = await this.jwtService.signAsync({ sessionId, sub: user.id, type: "refresh", audience }, { secret: this.refreshTokenSecret, expiresIn: rememberMe ? rememberMeRefreshTokenTtl : refreshTokenTtl, audience, issuer: this.tokenIssuer });
    this.sessions.set(sessionId, { user, refreshTokenHash: await bcrypt.hash(refreshToken, 12), rememberMe, expiresAt: new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000), audience });
    return { accessToken, refreshToken, rememberMe, user: this.publicUser(user) };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<{ sessionId: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sessionId: string; type: string }>(refreshToken, { secret: this.refreshTokenSecret });
      if (payload.type !== "refresh") throw new UnauthorizedException("Token invalide");
      return { sessionId: payload.sessionId };
    } catch {
      throw new UnauthorizedException("Session expiree");
    }
  }

  private async recordAuthAudit(action: AuditAction, user: AuditUserRecord | null, email: string, meta: { ipAddress?: string; userAgent?: string } = {}, message: string) {
    await this.auditLogs.create({
      tenantId: user?.tenantId,
      tenantName: typeof user?.tenant === "object" ? user?.tenant?.name : user?.tenant,
      userId: user?.id,
      userEmail: user?.email ?? email,
      userName: user?.name,
      action,
      entity: "Auth",
      message,
      metadata: { email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      browser: this.parseBrowser(meta.userAgent),
      operatingSystem: this.parseOperatingSystem(meta.userAgent)
    }).catch(() => undefined);
  }

  private parseBrowser(userAgent?: string) {
    if (!userAgent) return undefined;
    if (userAgent.includes("Edg/")) return "Microsoft Edge";
    if (userAgent.includes("Chrome/")) return "Chrome";
    if (userAgent.includes("Firefox/")) return "Firefox";
    if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) return "Safari";
    return "Autre";
  }

  private parseOperatingSystem(userAgent?: string) {
    if (!userAgent) return undefined;
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
    if (userAgent.includes("Mac OS")) return "macOS";
    if (userAgent.includes("Linux")) return "Linux";
    return "Autre";
  }

  private publicUser(user: AuthUser) {
    return { id: user.id, name: user.name, email: user.email, role: user.role, roles: user.roles, permissions: user.permissions, tenant: user.tenant, tenantId: user.tenantId, createdAt: user.createdAt };
  }

  private isPlatformAdmin(user: AuthUser) {
    return user.roles?.some((role) => role === "SUPER_ADMIN" || role === "PlatformAdmin") || user.role === "SUPER_ADMIN" || user.role === "PlatformAdmin";
  }

  private async ensureConfiguredSuperAdmin(email: string, password: string) {
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "admin@vtaerp.com").trim().toLowerCase();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "Admin@123456";
    if (email !== superAdminEmail || password !== superAdminPassword) return null;

    const tenant = await this.prisma.tenant.upsert({
      where: { slug: "vta-platform" },
      update: { name: "VTA ERP Platform", status: TenantStatus.ACTIVE },
      create: {
        id: "tenant_vta_platform",
        name: "VTA ERP Platform",
        slug: "vta-platform",
        email: superAdminEmail,
        currency: "HTG",
        timezone: "America/Port-au-Prince",
        language: "fr",
        status: TenantStatus.ACTIVE
      }
    });

    const role = await this.prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "SUPER_ADMIN" } },
      update: { description: "Super administrateur global VTA ERP", isSystem: true },
      create: { tenantId: tenant.id, name: "SUPER_ADMIN", description: "Super administrateur global VTA ERP", isSystem: true }
    });

    const user = await this.prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: superAdminEmail } },
      update: { name: "Super Admin VTA ERP", password: await bcrypt.hash(superAdminPassword, 12), isActive: true },
      create: {
        id: "usr_super_admin_vta_erp",
        tenantId: tenant.id,
        name: "Super Admin VTA ERP",
        email: superAdminEmail,
        password: await bcrypt.hash(superAdminPassword, 12),
        isActive: true
      }
    });

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id }
    });

    return this.findUserByEmail(superAdminEmail);
  }

  private async assertUserActive(userId: string) {
    if (userId === demoUser.id) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user || !user.isActive) throw new UnauthorizedException("Compte utilisateur desactive. Contactez votre administrateur.");
  }

  private async assertTenantCanLogin(user: AuthUser) {
    if (this.isPlatformAdmin(user)) return;
    await this.assertTenantStatus(user.tenantId);
  }

  private async assertTenantCanRequest(user: AuthUser) {
    if (this.isPlatformAdmin(user)) return;
    await this.assertTenantStatus(user.tenantId);
  }

  private async assertTenantStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true, subscription: { select: { endsAt: true } } } });
    if (!tenant) throw new UnauthorizedException("Entreprise introuvable");
    if (tenant.status === TenantStatus.PAUSED) throw new UnauthorizedException("Votre compte est en pause. Contactez VTA ERP.");
    if (tenant.status === TenantStatus.SUSPENDED) throw new UnauthorizedException("Votre compte est suspendu. Contactez VTA ERP.");
    if (tenant.status === TenantStatus.DELETED) throw new UnauthorizedException("Votre compte a ete supprime. Contactez VTA ERP.");
    if (tenant.status === TenantStatus.EXPIRED || tenant.status === TenantStatus.CANCELLED) throw new UnauthorizedException("Votre abonnement est expire. Contactez VTA ERP.");
    if (tenant.status === TenantStatus.TRIAL && tenant.subscription?.endsAt && tenant.subscription.endsAt.getTime() < Date.now()) {
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: TenantStatus.EXPIRED } });
      throw new UnauthorizedException("Votre abonnement est expire. Contactez VTA ERP.");
    }
  }

  private async touchTenantLogin(tenantId: string) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { lastLoginAt: new Date(), lastSeenAt: new Date() } }).catch(() => undefined);
  }

  private async touchTenantSeen(tenantId: string) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }

  private canRequestPasswordReset(email: string, ipAddress?: string) {
    const emailKey = `password-reset:email:${this.hashPasswordResetToken(email)}`;
    const ipKey = ipAddress ? `password-reset:ip:${this.hashPasswordResetToken(ipAddress)}` : undefined;
    return [emailKey, ipKey].filter((key): key is string => Boolean(key)).every((key) => this.consumePasswordResetAttempt(key));
  }

  private consumePasswordResetAttempt(key: string) {
    const now = Date.now();
    const current = this.passwordResetAttempts.get(key);

    if (!current || current.resetAt <= now) {
      this.passwordResetAttempts.set(key, { count: 1, resetAt: now + passwordResetRateLimitWindowMs });
      return true;
    }

    if (current.count >= passwordResetMaxAttempts) return false;
    current.count += 1;
    return true;
  }

  private buildPasswordResetUrl(rawToken: string) {
    try {
      const configuredBase = (process.env.PASSWORD_RESET_URL ?? process.env.PASSWORD_RESET_BASE_URL)?.trim();
      const webUrl = process.env.APP_PUBLIC_URL?.trim() ?? process.env.WEB_URL?.trim() ?? process.env.FRONTEND_URL?.trim() ?? "https://vtaerp.com";
      const baseUrl = configuredBase || new URL("/reset-password", webUrl).toString();
      const url = new URL(baseUrl);

      if (!url.pathname || url.pathname === "/") url.pathname = "/reset-password";
      if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;

      const allowedHosts = (process.env.PASSWORD_RESET_ALLOWED_HOSTS ?? "vtaerp.com,www.vtaerp.com,localhost")
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean);
      const hostAllowed = allowedHosts.includes(url.hostname.toLowerCase()) || url.hostname === "127.0.0.1";
      if (!hostAllowed) return null;

      url.searchParams.set("token", rawToken);
      return url.toString();
    } catch {
      return null;
    }
  }

  private invalidateUserSessions(userId: string) {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.user.id === userId) this.sessions.delete(sessionId);
    }
  }

  private get accessTokenSecret() {
    return process.env.JWT_SECRET ?? "change-me";
  }

  private get refreshTokenSecret() {
    return process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? "change-me-refresh";
  }

  private get tokenIssuer() {
    return process.env.JWT_ISSUER ?? "vtaerp.com";
  }

  private hashPasswordResetToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}

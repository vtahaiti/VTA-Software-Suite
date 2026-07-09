import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { TenantStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityService } from "../security/security.service";
import { defaultPermissions } from "../rbac/default-permissions";
import { LoginDto } from "./dto/login.dto";
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

type SessionRecord = { user: AuthUser; refreshTokenHash: string; rememberMe: boolean; expiresAt: Date };

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly jwtService: JwtService, private readonly prisma: PrismaService, private readonly security: SecurityService) {}

  async login(loginDto: LoginDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
    const email = loginDto.email.trim().toLowerCase();
    if (await this.security.isBlocked(email)) {
      await this.security.recordBlockedLogin(email, meta);
      throw new UnauthorizedException("Compte temporairement bloque apres plusieurs echecs. Reessayez plus tard.");
    }

    const user = await this.findUserByEmail(email);
    if (!user) {
      const passwordMatchesDemo = await bcrypt.compare(loginDto.password, demoPasswordHash);
      if (email !== adminEmail || !passwordMatchesDemo) {
        await this.security.recordLoginFailure(email, meta);
        throw new UnauthorizedException("Email ou mot de passe incorrect");
      }
      const authUser = this.toAuthUser(demoUser);
      const session = await this.createSession(authUser, Boolean(loginDto.rememberMe));
      await this.security.recordLoginSuccess(authUser, meta);
      return session;
    }

    if (user.isActive === false) {
      await this.security.recordLoginFailure(email, meta);
      throw new UnauthorizedException("Compte utilisateur desactive. Contactez votre administrateur.");
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordMatches) {
      await this.security.recordLoginFailure(email, meta);
      throw new UnauthorizedException("Email ou mot de passe incorrect");
    }
    const authUser = this.toAuthUser(user);
    await this.assertTenantCanLogin(authUser);
    await this.touchTenantLogin(authUser.tenantId);
    const session = await this.createSession(authUser, Boolean(loginDto.rememberMe));
    await this.security.recordLoginSuccess(authUser, meta);
    return session;
  }


  async issueSessionForUser(userId: string, rememberMe = true) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
    });
    if (!user) throw new UnauthorizedException("Utilisateur introuvable");
    return this.createSession(this.toAuthUser(user), rememberMe);
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
    return this.createSession(session.user, session.rememberMe);
  }

  async logout(sessionId: string, user?: AuthUser, meta: { ipAddress?: string; userAgent?: string } = {}) {
    this.sessions.delete(sessionId);
    if (user) await this.security.recordLogout(user, meta);
  }

  async verifyAccessToken(accessToken: string): Promise<AuthUser> {
    let payload: AuthUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthUser>(accessToken, { secret: this.accessTokenSecret });
    } catch {
      throw new UnauthorizedException("Token invalide");
    }
    if (!this.sessions.has(payload.sessionId)) throw new UnauthorizedException("Session invalide");
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

  private toAuthUser(user: any): AuthUser {
    const roles: string[] = user.roles?.map((entry: any) => entry.role?.name ?? entry).filter(Boolean) ?? ["Owner"];
    const permissions: string[] = user.roles?.flatMap((entry: any) => entry.role?.permissions?.map((rolePermission: any) => rolePermission.permission.key) ?? []) ?? defaultPermissions.map((permission) => permission.key);
    return {
      id: user.id,
      sessionId: "",
      tenantId: user.tenantId,
      tenant: user.tenant?.name ?? user.tenant ?? "VTA Enterprise",
      name: user.name,
      email: user.email,
      role: roles[0] ?? "Owner",
      roles,
      permissions: permissions.length ? [...new Set(permissions)] : defaultPermissions.map((permission) => permission.key),
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt
    };
  }

  private async createSession(baseUser: AuthUser, rememberMe: boolean) {
    const sessionId = randomUUID();
    const user: AuthUser = { ...baseUser, sessionId };
    const accessToken = await this.jwtService.signAsync(user, { secret: this.accessTokenSecret, expiresIn: accessTokenTtl });
    const refreshToken = await this.jwtService.signAsync({ sessionId, sub: user.id, type: "refresh" }, { secret: this.refreshTokenSecret, expiresIn: rememberMe ? rememberMeRefreshTokenTtl : refreshTokenTtl });
    this.sessions.set(sessionId, { user, refreshTokenHash: await bcrypt.hash(refreshToken, 12), rememberMe, expiresAt: new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000) });
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

  private publicUser(user: AuthUser) {
    return { id: user.id, name: user.name, email: user.email, role: user.role, roles: user.roles, permissions: user.permissions, tenant: user.tenant, tenantId: user.tenantId, createdAt: user.createdAt };
  }

  private isPlatformAdmin(user: AuthUser) {
    return user.roles?.includes("PlatformAdmin") || user.role === "PlatformAdmin";
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

  private get accessTokenSecret() {
    return process.env.JWT_SECRET ?? "change-me";
  }

  private get refreshTokenSecret() {
    return process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? "change-me-refresh";
  }
}

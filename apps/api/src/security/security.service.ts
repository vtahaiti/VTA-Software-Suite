import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma, SecurityEventType } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../prisma/prisma.service";

type SecurityMeta = { ipAddress?: string; userAgent?: string };
const maxFailedAttempts = 5;
const blockMinutes = 15;

@Injectable()
export class SecurityService {
  private readonly blockedUntil = new Map<string, Date>();

  constructor(private readonly prisma: PrismaService, private readonly auditLogs: AuditLogsService) {}

  async isBlocked(email: string) {
    const key = email.trim().toLowerCase();
    const until = this.blockedUntil.get(key);
    if (!until) return false;
    if (until.getTime() <= Date.now()) { this.blockedUntil.delete(key); return false; }
    return true;
  }

  async recordLoginSuccess(user: AuthUser, meta: SecurityMeta) {
    this.blockedUntil.delete(user.email.toLowerCase());
    await this.createLog({ tenantId: user.tenantId, userId: user.id, email: user.email, event: SecurityEventType.LOGIN_SUCCESS, status: "SUCCESS", ipAddress: meta.ipAddress, userAgent: meta.userAgent });
    await this.auditLogs.create({ tenantId: user.tenantId, tenantName: user.tenant, userId: user.id, userEmail: user.email, userName: user.name, action: AuditAction.LOGIN, entity: "Auth", message: "Connexion reussie", ipAddress: meta.ipAddress, userAgent: meta.userAgent });
  }

  async recordLoginFailure(email: string, meta: SecurityMeta) {
    const normalized = email.trim().toLowerCase();
    await this.createLog({ email: normalized, event: SecurityEventType.LOGIN_FAILED, status: "ERROR", ipAddress: meta.ipAddress, userAgent: meta.userAgent });
    await this.auditLogs.create({ userEmail: normalized, action: AuditAction.LOGIN_FAILED, entity: "Auth", message: "Connexion echouee", ipAddress: meta.ipAddress, userAgent: meta.userAgent }).catch(() => undefined);
    const since = new Date(Date.now() - blockMinutes * 60 * 1000);
    const recentFailures = await this.prisma.securityLog.count({ where: { email: normalized, event: SecurityEventType.LOGIN_FAILED, createdAt: { gte: since } } });
    if (recentFailures >= maxFailedAttempts) {
      const until = new Date(Date.now() + blockMinutes * 60 * 1000);
      this.blockedUntil.set(normalized, until);
      await this.createLog({ email: normalized, event: SecurityEventType.LOGIN_BLOCKED, status: "BLOCKED", ipAddress: meta.ipAddress, userAgent: meta.userAgent, metadata: { blockedUntil: until.toISOString() } });
    }
  }

  async recordBlockedLogin(email: string, meta: SecurityMeta) {
    await this.createLog({ email: email.trim().toLowerCase(), event: SecurityEventType.LOGIN_BLOCKED, status: "BLOCKED", ipAddress: meta.ipAddress, userAgent: meta.userAgent });
  }

  async recordLogout(user: AuthUser, meta: SecurityMeta) {
    await this.createLog({ tenantId: user.tenantId, userId: user.id, email: user.email, event: SecurityEventType.LOGOUT, status: "SUCCESS", ipAddress: meta.ipAddress, userAgent: meta.userAgent });
    await this.auditLogs.create({ tenantId: user.tenantId, tenantName: user.tenant, userId: user.id, userEmail: user.email, userName: user.name, action: AuditAction.LOGOUT, entity: "Auth", message: "Deconnexion securisee", ipAddress: meta.ipAddress, userAgent: meta.userAgent });
  }

  async preparePasswordChange(user: AuthUser) {
    await this.createLog({ tenantId: user.tenantId, userId: user.id, email: user.email, event: SecurityEventType.PASSWORD_CHANGE, status: "PREPARED" });
    await this.auditLogs.create({ tenantId: user.tenantId, userId: user.id, userEmail: user.email, action: AuditAction.SECURITY, entity: "User", entityId: user.id, message: "Changement de mot de passe prepare" });
    return { success: true, message: "Changement de mot de passe prepare." };
  }

  async findLogs(tenantId: string, query: { dateFrom?: string; dateTo?: string; user?: string }) {
    const where: Prisma.SecurityLogWhereInput = {
      OR: [{ tenantId }, { tenantId: null }],
      email: query.user ? { contains: query.user, mode: "insensitive" } : undefined,
      createdAt: this.dateFilter(query.dateFrom, query.dateTo)
    };
    return this.prisma.securityLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  }

  async summary(tenantId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [success, failed, blocked] = await Promise.all([
      this.prisma.securityLog.count({ where: { OR: [{ tenantId }, { tenantId: null }], event: SecurityEventType.LOGIN_SUCCESS, createdAt: { gte: since } } }),
      this.prisma.securityLog.count({ where: { OR: [{ tenantId }, { tenantId: null }], event: SecurityEventType.LOGIN_FAILED, createdAt: { gte: since } } }),
      this.prisma.securityLog.count({ where: { OR: [{ tenantId }, { tenantId: null }], event: SecurityEventType.LOGIN_BLOCKED, createdAt: { gte: since } } })
    ]);
    return { loginSuccess24h: success, loginFailed24h: failed, blocked24h: blocked, temporaryBlockMinutes: blockMinutes, maxFailedAttempts };
  }

  private createLog(data: Prisma.SecurityLogUncheckedCreateInput) {
    return this.prisma.securityLog.create({ data });
  }

  private dateFilter(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    return { gte: dateFrom ? new Date(dateFrom) : undefined, lte: dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined };
  }
}


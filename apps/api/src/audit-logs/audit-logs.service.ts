import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";

export type AuditQuery = {
  dateFrom?: string;
  dateTo?: string;
  date?: string;
  user?: string;
  userId?: string;
  action?: AuditAction;
  module?: string;
  entity?: string;
  storeId?: string;
  warehouseId?: string;
  q?: string;
  page?: string;
  limit?: string;
  sort?: "asc" | "desc";
};

type AuditInput = {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userPhotoUrl?: string;
  tenantName?: string;
  storeId?: string;
  storeName?: string;
  warehouseId?: string;
  warehouseName?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  message: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  operatingSystem?: string;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: AuditInput) {
    return this.prisma.auditLog.create({ data: input });
  }

  async findAllForUser(user: AuthUser, query: AuditQuery) {
    const { where, page, limit, sort } = await this.buildWhere(user, query);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: sort }, skip: (page - 1) * limit, take: limit }),
      this.prisma.auditLog.count({ where })
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findAll(tenantId: string, query: AuditQuery) {
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      action: query.action,
      entity: query.module ?? query.entity,
      storeId: query.storeId,
      warehouseId: query.warehouseId,
      OR: this.searchFilter(query)
    };
    where.createdAt = this.dateFilter(query.date ?? query.dateFrom, query.dateTo);
    return this.prisma.auditLog.findMany({ where, orderBy: { createdAt: query.sort === "asc" ? "asc" : "desc" }, skip: (page - 1) * limit, take: limit });
  }

  async findOneForUser(user: AuthUser, id: string) {
    const { where } = await this.buildWhere(user, {});
    const log = await this.prisma.auditLog.findFirst({ where: { ...where, id } });
    if (!log) throw new NotFoundException("Journal d'audit introuvable");
    return log;
  }

  async exportCsvForUser(user: AuthUser, query: AuditQuery) {
    const result = await this.findAllForUser(user, { ...query, limit: "1000" });
    const rows = result.items.map((log) => [
      log.createdAt.toISOString(),
      log.userName ?? log.userEmail ?? log.userId ?? "",
      log.tenantName ?? "",
      log.entity,
      log.action,
      log.message,
      log.ipAddress ?? "",
      log.browser ?? "",
      log.operatingSystem ?? ""
    ]);
    return [["Date", "Utilisateur", "Entreprise", "Module", "Action", "Description", "IP", "Navigateur", "Systeme"], ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  async exportCsv(tenantId: string, query: AuditQuery) {
    const logs = await this.findAll(tenantId, { ...query, limit: "1000" });
    const rows = logs.map((log) => [log.createdAt.toISOString(), log.action, log.entity, log.entityId ?? "", log.userEmail ?? log.userId ?? "", log.message]);
    return [["Date", "Action", "Entite", "ID", "Utilisateur", "Message"], ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  private async buildWhere(user: AuthUser, query: AuditQuery) {
    const page = this.page(query.page);
    const limit = this.limit(query.limit);
    const sort: Prisma.SortOrder = query.sort === "asc" ? "asc" : "desc";
    const where: Prisma.AuditLogWhereInput = {
      tenantId: user.tenantId,
      action: query.action,
      entity: query.module ?? query.entity,
      storeId: query.storeId,
      warehouseId: query.warehouseId,
      userId: query.userId,
      createdAt: this.dateFilter(query.date ?? query.dateFrom, query.dateTo),
      OR: this.searchFilter(query)
    };

    const role = (user.role ?? "").toLowerCase();
    const roles = (user.roles ?? []).map((entry) => entry.toLowerCase());
    const isOwnerOrAdmin = role.includes("owner") || role.includes("admin") || roles.some((entry) => entry.includes("owner") || entry.includes("admin"));
    const isCashier = role.includes("cashier") || role.includes("caissier") || roles.some((entry) => entry.includes("cashier") || entry.includes("caissier"));
    const isManager = role.includes("manager") || roles.some((entry) => entry.includes("manager"));

    if (isCashier) {
      where.userId = user.id;
    } else if (!isOwnerOrAdmin && isManager) {
      const storeUsers = await this.prisma.storeUser.findMany({ where: { tenantId: user.tenantId, userId: user.id, isActive: true }, select: { storeId: true } });
      const storeIds = storeUsers.map((entry) => entry.storeId);
      where.storeId = storeIds.length ? { in: storeIds } : "__no_store__";
    } else if (!isOwnerOrAdmin && !isManager) {
      where.userId = user.id;
    }

    return { where, page, limit, sort };
  }

  private searchFilter(query: AuditQuery): Prisma.AuditLogWhereInput[] | undefined {
    const text = query.q ?? query.user;
    if (!text) return undefined;
    return [
      { userEmail: { contains: text, mode: "insensitive" } },
      { userName: { contains: text, mode: "insensitive" } },
      { userId: { contains: text, mode: "insensitive" } },
      { entity: { contains: text, mode: "insensitive" } },
      { message: { contains: text, mode: "insensitive" } },
      { ipAddress: { contains: text, mode: "insensitive" } }
    ];
  }

  private dateFilter(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined;
    return { gte: from, lte: to };
  }

  private page(value?: string) {
    const parsed = Number(value ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private limit(value?: string) {
    const parsed = Number(value ?? 50);
    if (!Number.isFinite(parsed) || parsed < 1) return 50;
    return Math.min(parsed, 200);
  }
}


import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, NotificationStatus, NotificationType, Prisma, SaleStatus, SubscriptionPlan, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  FREE: 0,
  STARTER: 29,
  PRO: 79,
  ENTERPRISE: 199
};

const PLAN_PRICE_HTG: Record<SubscriptionPlan, number> = {
  FREE: 0,
  STARTER: 4000,
  PRO: 11000,
  ENTERPRISE: 28000
};

const PLATFORM_ROLE_NAMES = ["SUPER_ADMIN", "PlatformAdmin"];

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const [tenants, subscriptions, totalUsers, activeSessions, countries, latestTenants, criticalLogs, globalSales] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where: this.customerTenantWhere(),
        include: {
          companyProfile: true,
          subscription: true,
          _count: { select: { users: true, stores: true, warehouses: true, sales: true, products: true } }
        }
      }),
      this.prisma.tenantSubscription.findMany(),
      this.prisma.user.count(),
      this.prisma.securityLog.count({ where: { event: "LOGIN_SUCCESS", createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) } } }),
      this.prisma.companyProfile.findMany({ where: { country: { not: null } }, select: { country: true }, distinct: ["country"] }),
      this.prisma.tenant.findMany({
        where: this.customerTenantWhere(),
        include: { companyProfile: true, subscription: true },
        orderBy: { createdAt: "desc" },
        take: 8
      }),
      this.prisma.securityLog.findMany({ where: { event: { in: ["LOGIN_FAILED", "LOGIN_BLOCKED"] } }, orderBy: { createdAt: "desc" }, take: 8 }),
      this.prisma.sale.aggregate({ where: { status: SaleStatus.COMPLETED }, _sum: { total: true }, _count: { id: true } })
    ]);

    const activeTenants = tenants.filter((tenant) => tenant.status === TenantStatus.ACTIVE).length;
    const trialTenants = tenants.filter((tenant) => tenant.status === TenantStatus.TRIAL || tenant.subscription?.status === SubscriptionStatus.TRIALING).length;
    const suspendedTenants = tenants.filter((tenant) => tenant.status === TenantStatus.SUSPENDED).length;
    const pausedTenants = tenants.filter((tenant) => tenant.status === TenantStatus.PAUSED).length;
    const deletedTenants = tenants.filter((tenant) => tenant.status === TenantStatus.DELETED).length;
    const expiredTenants = tenants.filter((tenant) => tenant.status === TenantStatus.EXPIRED || tenant.status === TenantStatus.CANCELLED || this.isExpired(tenant.subscription?.endsAt)).length;
    const monthlyRevenue = subscriptions.reduce((sum, subscription) => subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIALING ? sum + Number(subscription.price || PLAN_PRICES[subscription.plan]) : sum, 0);
    const newSubscriptions = subscriptions.filter((subscription) => subscription.startedAt >= thirtyDaysAgo).length;
    const cancellations = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.CANCELLED).length;
    const storageUsedMb = tenants.reduce((sum, tenant) => sum + 25 + tenant._count.users * 2 + tenant._count.stores * 8 + tenant._count.warehouses * 4, 0);
    const expiringSubscriptions = subscriptions.filter((subscription) => subscription.endsAt && subscription.endsAt >= now && subscription.endsAt <= sevenDaysFromNow).length;
    const expiredSubscriptions = subscriptions.filter((subscription) => this.isExpired(subscription.endsAt)).length;

    return {
      totalTenants: tenants.length,
      activeTenants,
      trialTenants,
      suspendedTenants,
      pausedTenants,
      expiredTenants,
      deletedTenants,
      monthlyRevenue,
      globalSalesTotal: Number(globalSales._sum.total ?? 0),
      globalSalesCount: globalSales._count.id,
      newTenantsToday: tenants.filter((tenant) => tenant.createdAt >= today).length,
      newSubscriptions,
      cancellations,
      totalUsers,
      connectedUsers: activeSessions,
      countries: countries.length,
      storageUsedMb,
      alerts: {
        expiredPayments: expiredSubscriptions,
        renewalsDue: expiringSubscriptions,
        inactiveTenants: tenants.filter((tenant) => tenant.status !== TenantStatus.ACTIVE && tenant.status !== TenantStatus.TRIAL).length,
        criticalErrors: criticalLogs.length
      },
      charts: {
        tenantsCreated: this.monthlySeries(tenants.map((tenant) => tenant.createdAt)),
        subscriptions: this.monthlySeries(subscriptions.map((subscription) => subscription.startedAt)),
        revenue: this.revenueSeries(subscriptions),
        logins: await this.loginSeries(),
        activities: this.activityBreakdown(tenants)
      },
      latestTenants: latestTenants.map((tenant) => this.serializeTenantSummary(tenant))
    };
  }

  async tenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: this.customerTenantWhere(),
      include: {
        _count: { select: { users: true, stores: true, warehouses: true, products: true, sales: true, invoices: true } },
        companyProfile: true,
        subscription: true,
        businessModules: { include: { businessModule: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const [lastLogins, salesStats, monthlySalesStats, profitByTenant] = await Promise.all([
      this.latestLoginsByTenant(),
      this.salesStatsByTenant(),
      this.salesStatsByTenant(this.monthStart()),
      this.profitByTenant()
    ]);
    return tenants.map((tenant) => this.serializeTenantSummary(tenant, lastLogins.get(tenant.id), {
      totalRevenue: salesStats.get(tenant.id)?.revenue ?? 0,
      monthRevenue: monthlySalesStats.get(tenant.id)?.revenue ?? 0,
      salesCount: salesStats.get(tenant.id)?.count ?? tenant._count?.sales ?? 0,
      profit: profitByTenant.get(tenant.id) ?? 0
    }));
  }

  async tenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        companyProfile: true,
        subscription: true,
        businessModules: { include: { businessModule: true }, orderBy: { createdAt: "asc" } },
        users: { include: { roles: { include: { role: true } }, profile: true }, orderBy: { createdAt: "desc" } },
        stores: true,
        warehouses: true,
        _count: { select: { users: true, stores: true, warehouses: true, products: true, sales: true, invoices: true } }
      }
    });
    if (!tenant) throw new NotFoundException("Entreprise introuvable");

    const [lastLogins, availableModules, notes, securityEvents, salesAggregate, monthSalesAggregate, productCount, invoiceCount, paymentAggregate] = await Promise.all([
      this.prisma.securityLog.findMany({ where: { tenantId: id, event: "LOGIN_SUCCESS" }, orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.businessModule.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
      this.prisma.auditLog.findMany({ where: { tenantId: id, entity: "PLATFORM_NOTE" }, orderBy: { createdAt: "desc" }, take: 8 }),
      this.prisma.securityLog.findMany({ where: { tenantId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
      this.prisma.sale.aggregate({ where: { tenantId: id, status: SaleStatus.COMPLETED }, _sum: { total: true }, _count: { id: true } }),
      this.prisma.sale.aggregate({ where: { tenantId: id, status: SaleStatus.COMPLETED, createdAt: { gte: this.monthStart() } }, _sum: { total: true }, _count: { id: true } }),
      this.prisma.product.count({ where: { tenantId: id } }),
      this.prisma.invoice.count({ where: { tenantId: id } }),
      this.prisma.payment.aggregate({ where: { sale: { tenantId: id } }, _sum: { amount: true }, _count: { id: true } })
    ]);

    const activeModuleKeys = new Set(tenant.businessModules.filter((entry) => entry.isActive).map((entry) => entry.businessModule.key));
    return {
      ...this.serializeTenantSummary(tenant, lastLogins[0]),
      subscription: this.serializeSubscription(tenant.subscription),
      users: tenant.users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles.map((entry) => entry.role.name),
        photoUrl: user.profile?.photoUrl ?? null,
        createdAt: user.createdAt
      })),
      licenses: {
        users: tenant._count.users,
        stores: tenant._count.stores,
        warehouses: tenant._count.warehouses,
        modulesActive: activeModuleKeys.size,
        modulesDisabled: Math.max(availableModules.length - activeModuleKeys.size, 0)
      },
      statistics: {
        users: tenant._count.users,
        products: productCount,
        sales: salesAggregate._count.id,
        invoices: invoiceCount,
        payments: paymentAggregate._count.id,
        revenueTotal: Number(salesAggregate._sum.total ?? 0),
        revenueMonth: Number(monthSalesAggregate._sum.total ?? 0),
        paymentsTotal: Number(paymentAggregate._sum.amount ?? 0)
      },
      modules: availableModules.map((module) => ({
        key: module.key,
        name: module.name,
        category: module.category,
        isActive: activeModuleKeys.has(module.key)
      })),
      lastLogins,
      security: securityEvents.map((event) => ({ id: event.id, event: event.event, status: event.status, email: event.email, ipAddress: event.ipAddress, userAgent: event.userAgent, createdAt: event.createdAt })),
      notes: notes.map((note) => ({ id: note.id, message: note.message, createdAt: note.createdAt }))
    };
  }

  async updateTenantStatus(id: string, status: TenantStatus) {
    await this.ensureTenantExists(id);
    return this.prisma.tenant.update({ where: { id }, data: { status }, select: { id: true, name: true, status: true } });
  }

  async updateSubscription(id: string, data: { plan?: SubscriptionPlan; status?: SubscriptionStatus; startedAt?: string; endsAt?: string; autoRenew?: boolean }) {
    await this.ensureTenantExists(id);
    const subscription = await this.prisma.tenantSubscription.upsert({
      where: { tenantId: id },
      update: {
        plan: data.plan,
        status: data.status,
        price: data.plan ? PLAN_PRICE_HTG[data.plan] : undefined,
        currency: "HTG",
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined
      },
      create: {
        tenantId: id,
        plan: data.plan ?? SubscriptionPlan.STARTER,
        status: data.status ?? SubscriptionStatus.ACTIVE,
        price: PLAN_PRICE_HTG[data.plan ?? SubscriptionPlan.STARTER],
        currency: "HTG",
        startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined
      }
    });
    return subscription;
  }

  async toggleTenantModule(id: string, moduleKey: string, isActive: boolean) {
    await this.ensureTenantExists(id);
    const module = await this.prisma.businessModule.findUnique({ where: { key: moduleKey } });
    if (!module) throw new NotFoundException("Module introuvable");
    const assignment = await this.prisma.tenantBusinessModule.upsert({
      where: { tenantId_businessModuleId: { tenantId: id, businessModuleId: module.id } },
      update: { isActive, disabledAt: isActive ? null : new Date(), source: "platform" },
      create: { tenantId: id, businessModuleId: module.id, isActive, source: "platform", disabledAt: isActive ? null : new Date() }
    });
    const activeModules = await this.prisma.tenantBusinessModule.findMany({ where: { tenantId: id, isActive: true }, include: { businessModule: true } });
    await this.prisma.tenant.update({ where: { id }, data: { enabledBusinessModules: activeModules.map((entry) => entry.businessModule.key) } });
    return { module: module.name, key: module.key, isActive: assignment.isActive };
  }

  async addNote(id: string, note: string) {
    const tenant = await this.ensureTenantExists(id);
    return this.prisma.auditLog.create({
      data: {
        tenantId: id,
        tenantName: tenant.name,
        action: AuditAction.UPDATE,
        entity: "PLATFORM_NOTE",
        message: note
      }
    });
  }

  async sendTenantNotification(id: string, data: { title: string; message: string }) {
    const tenant = await this.ensureTenantExists(id);
    const users = await this.prisma.user.findMany({ where: { tenantId: id }, select: { id: true } });
    if (!users.length) return { delivered: 0 };

    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        tenantId: id,
        userId: user.id,
        title: data.title,
        message: data.message,
        type: NotificationType.INFO,
        status: NotificationStatus.UNREAD,
        module: "platform"
      }))
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: id,
        tenantName: tenant.name,
        action: AuditAction.UPDATE,
        entity: "PLATFORM_NOTIFICATION",
        message: data.message,
        metadata: { title: data.title, delivered: users.length }
      }
    });

    return { delivered: users.length };
  }

  async prepareTenantEmail(id: string, data: { title: string; message: string; subject?: string }) {
    const tenant = await this.ensureTenantExists(id);
    const users = await this.prisma.user.findMany({ where: { tenantId: id }, select: { email: true } });
    const recipients = users.map((user) => user.email).filter(Boolean);

    const log = await this.prisma.auditLog.create({
      data: {
        tenantId: id,
        tenantName: tenant.name,
        action: AuditAction.UPDATE,
        entity: "PLATFORM_EMAIL",
        message: data.message,
        metadata: {
          title: data.title,
          subject: data.subject ?? data.title,
          recipients,
          status: "prepared"
        }
      }
    });

    return { prepared: true, recipients: recipients.length, logId: log.id };
  }

  async subscriptions() {
    const tenants = await this.prisma.tenant.findMany({ include: { companyProfile: true, subscription: true }, orderBy: { createdAt: "desc" } });
    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.companyProfile?.companyName ?? tenant.name,
      activity: tenant.primaryActivity,
      status: tenant.status,
      subscription: this.serializeSubscription(tenant.subscription),
      createdAt: tenant.createdAt
    }));
  }

  async modules() {
    const [modules, assignments] = await this.prisma.$transaction([
      this.prisma.businessModule.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
      this.prisma.tenantBusinessModule.findMany({ where: { isActive: true }, include: { businessModule: true } })
    ]);
    return modules.map((module) => ({
      key: module.key,
      name: module.name,
      category: module.category,
      activeTenants: assignments.filter((entry) => entry.businessModuleId === module.id).length,
      permissions: module.permissions.length
    }));
  }

  async deleteTenant(id: string) {
    await this.ensureTenantCanBeDeleted(id);
    const tenant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id },
        data: {
          status: TenantStatus.DELETED,
          deletedAt: new Date(),
          users: { updateMany: { where: { tenantId: id }, data: { isActive: false } } }
        },
        select: { id: true, name: true, status: true, deletedAt: true }
      });
      await tx.auditLog.create({
        data: {
          tenantId: id,
          tenantName: updated.name,
          action: AuditAction.DELETE,
          entity: "PLATFORM_TENANT",
          entityId: id,
          message: "Entreprise marquee comme supprimee depuis le Control Center."
        }
      });
      return updated;
    });
    return { deleted: true, softDeleted: true, tenant };
  }

  async deleteDemoTenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: {
        OR: [
          { slug: { contains: "demo", mode: "insensitive" } },
          { slug: { contains: "test", mode: "insensitive" } },
          { slug: { contains: "qa", mode: "insensitive" } },
          { name: { contains: "demo", mode: "insensitive" } },
          { name: { contains: "test", mode: "insensitive" } },
          { name: { contains: "qa", mode: "insensitive" } }
        ]
      },
      select: { id: true, name: true }
    });

    const deleted = [];
    const skipped = [];
    for (const tenant of tenants) {
      try {
        const result = await this.deleteTenant(tenant.id);
        deleted.push(result.tenant);
      } catch {
        skipped.push(tenant);
      }
    }
    return { deletedCount: deleted.length, deleted, skipped };
  }

  async logs() {
    const [auditLogs, securityLogs] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where: { OR: [{ entity: "PLATFORM_NOTE" }, { action: { in: ["SECURITY", "BACKUP"] } }] }, orderBy: { createdAt: "desc" }, take: 40 }),
      this.prisma.securityLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 })
    ]);

    return [
      ...auditLogs.map((log) => ({ id: log.id, type: log.entity === "PLATFORM_NOTE" ? "Note interne" : "Audit", tenantId: log.tenantId, tenantName: log.tenantName, user: log.userName ?? log.userEmail, action: log.action, message: log.message, createdAt: log.createdAt })),
      ...securityLogs.map((log) => ({ id: log.id, type: "Securite", tenantId: log.tenantId, tenantName: null, user: log.email, action: log.event, message: log.status, ipAddress: log.ipAddress, userAgent: log.userAgent, createdAt: log.createdAt }))
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 60);
  }

  private serializeTenantSummary(tenant: any, lastLogin?: any, stats?: { totalRevenue?: number; monthRevenue?: number; profit?: number; salesCount?: number }) {
    const subscription = this.serializeSubscription(tenant.subscription);
    return {
      id: tenant.id,
      logoUrl: tenant.companyProfile?.logoUrl ?? null,
      name: tenant.companyProfile?.companyName ?? tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      deletedAt: tenant.deletedAt ?? null,
      email: tenant.companyProfile?.email ?? tenant.email,
      phone: tenant.companyProfile?.phone ?? tenant.phone,
      currency: tenant.companyProfile?.currency ?? tenant.currency ?? "HTG",
      country: tenant.companyProfile?.country ?? null,
      city: tenant.companyProfile?.city ?? null,
      primaryActivity: tenant.primaryActivity ?? tenant.companyProfile?.primaryActivity ?? tenant.companyProfile?.industry,
      businessProfileType: tenant.businessProfileType,
      version: "Cloud",
      plan: subscription.plan,
      subscriptionStatus: subscription.status,
      subscriptionEndsAt: subscription.endsAt,
      lastLoginAt: lastLogin?.createdAt ?? null,
      lastSeenAt: tenant.lastSeenAt ?? null,
      lastLoginIp: lastLogin?.ipAddress ?? null,
      modules: tenant.businessModules?.filter((entry: any) => entry.isActive !== false).map((entry: any) => ({ key: entry.businessModule.key, name: entry.businessModule.name, category: entry.businessModule.category })) ?? [],
      users: tenant._count?.users ?? 0,
      products: tenant._count?.products ?? 0,
      sales: stats?.salesCount ?? tenant._count?.sales ?? 0,
      invoices: tenant._count?.invoices ?? 0,
      revenueTotal: stats?.totalRevenue ?? 0,
      revenueMonth: stats?.monthRevenue ?? 0,
      profit: stats?.profit ?? 0,
      stores: tenant._count?.stores ?? 0,
      warehouses: tenant._count?.warehouses ?? 0,
      createdAt: tenant.createdAt
    };
  }

  private serializeSubscription(subscription: any) {
    return {
      plan: subscription?.plan ?? SubscriptionPlan.FREE,
      status: subscription?.status ?? SubscriptionStatus.TRIALING,
      startedAt: subscription?.startedAt ?? null,
      endsAt: subscription?.endsAt ?? null,
      monthlyPrice: PLAN_PRICES[(subscription?.plan ?? SubscriptionPlan.FREE) as SubscriptionPlan],
      price: Number(subscription?.price ?? 0),
      currency: subscription?.currency ?? "HTG",
      paymentStatus: subscription?.paymentStatus ?? "UNPAID",
      paymentReceived: subscription?.status === SubscriptionStatus.ACTIVE,
      paymentPending: subscription?.status === SubscriptionStatus.PAST_DUE,
      autoRenew: subscription?.status === SubscriptionStatus.ACTIVE,
      trial: subscription?.status === SubscriptionStatus.TRIALING
    };
  }

  private async latestLoginsByTenant() {
    const logs = await this.prisma.securityLog.findMany({ where: { event: "LOGIN_SUCCESS", tenantId: { not: null } }, orderBy: { createdAt: "desc" }, take: 500 });
    const map = new Map<string, any>();
    for (const log of logs) if (log.tenantId && !map.has(log.tenantId)) map.set(log.tenantId, log);
    return map;
  }

  private async salesStatsByTenant(from?: Date) {
    const groups = await this.prisma.sale.groupBy({
      by: ["tenantId"],
      where: { status: SaleStatus.COMPLETED, ...(from ? { createdAt: { gte: from } } : {}) },
      _sum: { total: true },
      _count: { id: true }
    });
    return new Map(groups.map((group) => [group.tenantId, { revenue: Number(group._sum.total ?? 0), count: group._count.id }]));
  }

  private async profitByTenant() {
    const items = await this.prisma.saleItem.findMany({
      where: { sale: { status: SaleStatus.COMPLETED } },
      select: { quantity: true, total: true, sale: { select: { tenantId: true } }, product: { select: { purchasePrice: true } } }
    });
    const map = new Map<string, number>();
    for (const item of items) {
      const profit = Number(item.total) - Number(item.product.purchasePrice) * item.quantity;
      map.set(item.sale.tenantId, (map.get(item.sale.tenantId) ?? 0) + profit);
    }
    return map;
  }

  private customerTenantWhere(): Prisma.TenantWhereInput {
    return {
      NOT: {
        users: {
          some: {
            roles: {
              some: { role: { name: { in: PLATFORM_ROLE_NAMES } } }
            }
          }
        }
      }
    };
  }

  private monthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private async loginSeries() {
    const logs = await this.prisma.securityLog.findMany({ where: { event: "LOGIN_SUCCESS" }, select: { createdAt: true } });
    return this.monthlySeries(logs.map((log) => log.createdAt));
  }

  private monthlySeries(dates: Date[]) {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { label: date.toLocaleDateString("fr-HT", { month: "short" }), value: dates.filter((item) => item.getFullYear() === date.getFullYear() && item.getMonth() === date.getMonth()).length, key };
    });
  }

  private revenueSeries(subscriptions: Array<{ startedAt: Date; plan: SubscriptionPlan; status: SubscriptionStatus }>) {
    const series = this.monthlySeries(subscriptions.map((subscription) => subscription.startedAt));
    return series.map((point) => ({ ...point, value: subscriptions.filter((subscription) => `${subscription.startedAt.getFullYear()}-${String(subscription.startedAt.getMonth() + 1).padStart(2, "0")}` === point.key && subscription.status !== SubscriptionStatus.CANCELLED).reduce((sum, subscription) => sum + PLAN_PRICES[subscription.plan], 0) }));
  }

  private activityBreakdown(tenants: Array<{ primaryActivity: string | null }>) {
    const map = new Map<string, number>();
    for (const tenant of tenants) {
      const activity = tenant.primaryActivity ?? "Non defini";
      map.set(activity, (map.get(activity) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }

  private isExpired(date?: Date | null) {
    return Boolean(date && date.getTime() < Date.now());
  }

  private async ensureTenantExists(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!tenant) throw new NotFoundException("Entreprise introuvable");
    return tenant;
  }

  private async ensureTenantCanBeDeleted(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, include: { users: { include: { roles: { include: { role: true } } } } } });
    if (!tenant) throw new NotFoundException("Entreprise introuvable");
    const hasPlatformAdmin = tenant.users.some((user) => user.roles.some((entry) => PLATFORM_ROLE_NAMES.includes(entry.role.name)));
    if (hasPlatformAdmin) throw new BadRequestException("Impossible de supprimer une entreprise contenant un SUPER_ADMIN");
  }
}



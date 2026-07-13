import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, NotificationStatus, NotificationType, Prisma, SubscriptionPlan, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionEntitlementsService } from "../subscriptions/subscription-entitlements.service";

const PLAN_PRICES_HTG: Record<SubscriptionPlan, number> = {
  FREE: 0,
  STARTER: 1000,
  PRO: 2000,
  ENTERPRISE: 4000,
  ESSENTIAL: 1000,
  STANDARD: 2000,
  EXPERT: 4000
};

const PLATFORM_ROLE_NAMES = ["SUPER_ADMIN", "PlatformAdmin"];
const CUSTOMER_VISIBLE_STATUSES: TenantStatus[] = [TenantStatus.ACTIVE, TenantStatus.TRIAL, TenantStatus.PAUSED, TenantStatus.SUSPENDED, TenantStatus.EXPIRED];
const BILLABLE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING];
const BLOCKING_TENANT_STATUSES: TenantStatus[] = [TenantStatus.PAUSED, TenantStatus.SUSPENDED, TenantStatus.EXPIRED, TenantStatus.DELETED];

type TenantWithAdminRelations = Prisma.TenantGetPayload<{
  include: {
    companyProfile: true;
    subscription: { include: { planRecord: true } };
    businessModules: { include: { businessModule: true } };
    _count: { select: { users: true; stores: true; warehouses: true } };
  };
}>;

type PlatformSubscription = Prisma.TenantSubscriptionGetPayload<{ include: { planRecord: true } }> | Prisma.TenantSubscriptionGetPayload<Record<string, never>> | null;
type SecurityLogSummary = { createdAt?: Date; ipAddress?: string | null };

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: SubscriptionEntitlementsService) {}

  async stats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const [tenants, subscriptions, totalUsers, activeSessions, countries, latestTenants, criticalLogs] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where: this.customerTenantWhere(),
        include: {
          companyProfile: true,
          subscription: { include: { planRecord: true } },
          businessModules: { include: { businessModule: true } },
          _count: { select: { users: true, stores: true, warehouses: true } }
        }
      }),
      this.prisma.tenantSubscription.findMany({ where: { tenant: this.customerTenantWhere() } }),
      this.prisma.user.count({ where: { tenant: this.customerTenantWhere(), isActive: true } }),
      this.prisma.securityLog.count({ where: { event: "LOGIN_SUCCESS", createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) } } }),
      this.prisma.companyProfile.findMany({ where: { tenant: this.customerTenantWhere(), country: { not: null } }, select: { country: true }, distinct: ["country"] }),
      this.prisma.tenant.findMany({
        where: this.customerTenantWhere(),
        include: { companyProfile: true, subscription: { include: { planRecord: true } }, businessModules: { include: { businessModule: true } }, _count: { select: { users: true, stores: true, warehouses: true } } },
        orderBy: { createdAt: "desc" },
        take: 8
      }),
      this.prisma.securityLog.findMany({ where: { event: { in: ["LOGIN_FAILED", "LOGIN_BLOCKED"] } }, orderBy: { createdAt: "desc" }, take: 8 })
    ]);

    const activeTenants = tenants.filter((tenant) => tenant.status === TenantStatus.ACTIVE).length;
    const trialTenants = tenants.filter((tenant) => tenant.status === TenantStatus.TRIAL || tenant.subscription?.status === SubscriptionStatus.TRIALING).length;
    const suspendedTenants = tenants.filter((tenant) => tenant.status === TenantStatus.SUSPENDED).length;
    const pausedTenants = tenants.filter((tenant) => tenant.status === TenantStatus.PAUSED).length;
    const deletedTenants = tenants.filter((tenant) => tenant.status === TenantStatus.DELETED).length;
    const expiredTenants = tenants.filter((tenant) => tenant.status === TenantStatus.EXPIRED || tenant.status === TenantStatus.CANCELLED || this.isExpired(tenant.subscription?.endsAt)).length;
    const monthlyRevenue = this.subscriptionRevenueByCurrency(subscriptions.filter((subscription) => BILLABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)));
    const newSubscriptions = subscriptions.filter((subscription) => subscription.startedAt >= thirtyDaysAgo).length;
    const cancellations = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.CANCELLED).length;
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
      newTenantsToday: tenants.filter((tenant) => tenant.createdAt >= today).length,
      newSubscriptions,
      cancellations,
      totalUsers,
      connectedUsers: activeSessions,
      countries: countries.length,
      storage: { measured: false, label: "Non mesuré" },
      alerts: {
        expiredPayments: expiredSubscriptions,
        renewalsDue: expiringSubscriptions,
        inactiveTenants: tenants.filter((tenant) => !([TenantStatus.ACTIVE, TenantStatus.TRIAL] as TenantStatus[]).includes(tenant.status)).length,
        criticalErrors: criticalLogs.length
      },
      charts: {
        tenantsCreated: this.monthlySeries(tenants.map((tenant) => tenant.createdAt)),
        subscriptions: this.monthlySeries(subscriptions.map((subscription) => subscription.startedAt)),
        revenue: this.subscriptionRevenueSeries(subscriptions),
        logins: await this.platformLoginSeries(),
        activities: this.activityBreakdown(tenants)
      },
      latestTenants: latestTenants.map((tenant) => this.serializeTenantSummary(tenant))
    };
  }

  async tenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: this.customerTenantWhere(),
      include: {
        _count: { select: { users: true, stores: true, warehouses: true } },
        companyProfile: true,
        subscription: { include: { planRecord: true } },
        businessModules: { include: { businessModule: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const lastLogins = await this.latestLoginsByTenant();
    return tenants.map((tenant) => this.serializeTenantSummary(tenant, lastLogins.get(tenant.id)));
  }

  async tenant(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, ...this.customerTenantWhere() },
      include: {
        companyProfile: true,
        subscription: { include: { planRecord: true } },
        businessModules: { include: { businessModule: true }, orderBy: { createdAt: "asc" } },
        users: { include: { roles: { include: { role: true } }, profile: true }, orderBy: { createdAt: "desc" } },
        stores: { select: { id: true, name: true, status: true, createdAt: true } },
        warehouses: { select: { id: true, name: true, status: true, isActive: true, createdAt: true } },
        _count: { select: { users: true, stores: true, warehouses: true } }
      }
    });
    if (!tenant) throw new NotFoundException("Entreprise introuvable");

    const [lastLogins, availableModules, notes, securityEvents] = await Promise.all([
      this.prisma.securityLog.findMany({ where: { tenantId: id, event: "LOGIN_SUCCESS" }, orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.businessModule.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
      this.prisma.auditLog.findMany({ where: { tenantId: id, entity: { in: ["PLATFORM_NOTE", "PLATFORM_TENANT_STATUS", "PLATFORM_SUBSCRIPTION", "PLATFORM_MODULE", "PLATFORM_NOTIFICATION", "PLATFORM_EMAIL"] } }, orderBy: { createdAt: "desc" }, take: 20 }),
      this.prisma.securityLog.findMany({ where: { tenantId: id }, orderBy: { createdAt: "desc" }, take: 10 })
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
        isActive: user.isActive,
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
        stores: tenant._count.stores,
        warehouses: tenant._count.warehouses,
        storage: "Non mesuré"
      },
      modules: availableModules.map((module) => ({
        key: module.key,
        name: module.name,
        category: module.category,
        isActive: activeModuleKeys.has(module.key)
      })),
      stores: tenant.stores,
      warehouses: tenant.warehouses,
      lastLogins,
      security: securityEvents.map((event) => ({ id: event.id, event: event.event, status: event.status, email: event.email, ipAddress: event.ipAddress, userAgent: event.userAgent, createdAt: event.createdAt })),
      notes: notes.map((note) => ({ id: note.id, entity: note.entity, message: note.message, metadata: note.metadata, createdAt: note.createdAt }))
    };
  }

  async updateTenantStatus(id: string, status: TenantStatus, reason?: string) {
    const tenant = await this.ensureTenantCanBeManaged(id);
    this.assertTenantTransition(tenant.status, status);
    if (BLOCKING_TENANT_STATUSES.includes(status) && !reason?.trim()) {
      throw new BadRequestException("Un motif est obligatoire pour cette action.");
    }
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        status,
        deletedAt: status === TenantStatus.DELETED ? new Date() : tenant.deletedAt
      },
      select: { id: true, name: true, status: true, deletedAt: true }
    });
    await this.writePlatformAudit(id, tenant.name, AuditAction.UPDATE, "PLATFORM_TENANT_STATUS", `Statut entreprise: ${tenant.status} -> ${status}`, {
      oldValue: { status: tenant.status },
      newValue: { status },
      metadata: { reason: reason?.trim() ?? null }
    });
    return updated;
  }

  async updateSubscription(id: string, data: { plan?: SubscriptionPlan; status?: SubscriptionStatus; startedAt?: string; endsAt?: string; autoRenew?: boolean; reason?: string }, actorUserId?: string) {
    const tenant = await this.ensureTenantCanBeManaged(id);
    const previous = await this.prisma.tenantSubscription.findUnique({ where: { tenantId: id } });
    const plan = data.plan ?? previous?.plan ?? SubscriptionPlan.ESSENTIAL;
    const planRecord = await this.planRecordFor(plan);
    const subscription = await this.prisma.tenantSubscription.upsert({
      where: { tenantId: id },
      update: {
        plan: data.plan,
        planId: planRecord?.id,
        status: data.status,
        price: data.plan ? PLAN_PRICES_HTG[data.plan] : undefined,
        currency: "HTG",
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        currentPeriodStart: data.startedAt ? new Date(data.startedAt) : undefined,
        currentPeriodEnd: data.endsAt ? new Date(data.endsAt) : undefined,
        suspendedAt: data.status === SubscriptionStatus.SUSPENDED ? new Date() : undefined,
        canceledAt: data.status === SubscriptionStatus.CANCELED || data.status === SubscriptionStatus.CANCELLED ? new Date() : undefined
      },
      create: {
        tenantId: id,
        plan,
        planId: planRecord?.id,
        status: data.status ?? SubscriptionStatus.ACTIVE,
        price: PLAN_PRICES_HTG[plan],
        currency: "HTG",
        startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        currentPeriodStart: data.startedAt ? new Date(data.startedAt) : new Date(),
        currentPeriodEnd: data.endsAt ? new Date(data.endsAt) : undefined
      }
    });
    await this.prisma.subscriptionEvent.create({
      data: {
        tenantId: id,
        subscriptionId: subscription.id,
        eventType: "SUBSCRIPTION_UPDATED",
        previousStatus: previous?.status,
        newStatus: subscription.status,
        actorUserId,
        metadata: { reason: data.reason?.trim() ?? null, previousPlan: previous?.plan ?? null, newPlan: subscription.plan, planCode: planRecord?.code ?? null }
      }
    }).catch(() => undefined);
    if (data.plan) {
      await this.prisma.subscriptionEvent.create({
        data: {
          tenantId: id,
          subscriptionId: subscription.id,
          eventType: "PLAN_CHANGE_CONFIRMED",
          previousStatus: previous?.status,
          newStatus: subscription.status,
          actorUserId,
          metadata: { reason: data.reason?.trim() ?? null, previousPlan: previous?.plan ?? null, newPlan: subscription.plan, planCode: planRecord?.code ?? null }
        }
      }).catch(() => undefined);
    }
    this.entitlements.invalidate(id);
    await this.writePlatformAudit(id, tenant.name, AuditAction.UPDATE, "PLATFORM_SUBSCRIPTION", "Abonnement modifié depuis le Control Center.", {
      oldValue: previous ? this.serializeSubscription(previous) : undefined,
      newValue: this.serializeSubscription(subscription),
      userId: actorUserId,
      metadata: { reason: data.reason?.trim() ?? null, actorUserId: actorUserId ?? null }
    });
    return subscription;
  }

  async toggleTenantModule(id: string, moduleKey: string, isActive: boolean, reason?: string) {
    const tenant = await this.ensureTenantCanBeManaged(id);
    const module = await this.prisma.businessModule.findUnique({ where: { key: moduleKey } });
    if (!module) throw new NotFoundException("Module introuvable");
    const assignment = await this.prisma.tenantBusinessModule.upsert({
      where: { tenantId_businessModuleId: { tenantId: id, businessModuleId: module.id } },
      update: { isActive, disabledAt: isActive ? null : new Date(), source: "platform" },
      create: { tenantId: id, businessModuleId: module.id, isActive, source: "platform", disabledAt: isActive ? null : new Date() }
    });
    const activeModules = await this.prisma.tenantBusinessModule.findMany({ where: { tenantId: id, isActive: true }, include: { businessModule: true } });
    await this.prisma.tenant.update({ where: { id }, data: { enabledBusinessModules: activeModules.map((entry) => entry.businessModule.key) } });
    await this.writePlatformAudit(id, tenant.name, AuditAction.UPDATE, "PLATFORM_MODULE", `${isActive ? "Activation" : "Désactivation"} du module ${module.name}.`, {
      metadata: { moduleKey, moduleName: module.name, isActive, reason: reason?.trim() ?? null }
    });
    return { module: module.name, key: module.key, isActive: assignment.isActive };
  }

  async addNote(id: string, note: string) {
    const tenant = await this.ensureTenantCanBeManaged(id);
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
    const tenant = await this.ensureTenantCanBeManaged(id);
    const users = await this.prisma.user.findMany({ where: { tenantId: id, isActive: true }, select: { id: true } });
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

    await this.writePlatformAudit(id, tenant.name, AuditAction.UPDATE, "PLATFORM_NOTIFICATION", data.message, {
      metadata: { title: data.title, delivered: users.length }
    });

    return { delivered: users.length };
  }

  async prepareTenantEmail(id: string, data: { title: string; message: string; subject?: string }) {
    const tenant = await this.ensureTenantCanBeManaged(id);
    const users = await this.prisma.user.findMany({ where: { tenantId: id, isActive: true }, select: { email: true } });
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
          recipientsCount: recipients.length,
          status: "prepared"
        }
      }
    });

    return { prepared: true, recipients: recipients.length, logId: log.id };
  }

  async subscriptions() {
    const tenants = await this.prisma.tenant.findMany({ where: this.customerTenantWhere(), include: { companyProfile: true, subscription: { include: { planRecord: true } }, _count: { select: { users: true, stores: true } } }, orderBy: { createdAt: "desc" } });
    const pendingRequests = await this.latestPendingPlanRequests(tenants.map((tenant) => tenant.id));
    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.companyProfile?.companyName ?? tenant.name,
      activity: tenant.primaryActivity,
      status: tenant.status,
      subscription: { ...this.serializeSubscription(tenant.subscription), pendingRequest: pendingRequests.get(tenant.id) ?? null },
      licenses: { users: tenant._count.users, stores: tenant._count.stores },
      createdAt: tenant.createdAt
    }));
  }

  async modules() {
    const [modules, assignments] = await this.prisma.$transaction([
      this.prisma.businessModule.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
      this.prisma.tenantBusinessModule.findMany({ where: { isActive: true, tenant: this.customerTenantWhere() }, include: { businessModule: true } })
    ]);
    return modules.map((module) => ({
      key: module.key,
      name: module.name,
      category: module.category,
      activeTenants: assignments.filter((entry) => entry.businessModuleId === module.id).length,
      permissions: module.permissions.length
    }));
  }

  plans() {
    return this.entitlements.listPlans();
  }

  async deleteTenant(id: string, reason?: string) {
    const tenant = await this.ensureTenantCanBeManaged(id);
    if (!reason?.trim()) throw new BadRequestException("Un motif est obligatoire avant toute suppression.");
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.tenant.update({
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
          tenantName: tenant.name,
          action: AuditAction.DELETE,
          entity: "PLATFORM_TENANT",
          entityId: id,
          message: "Entreprise désactivée depuis la zone dangereuse du Control Center.",
          metadata: { reason: reason.trim(), mode: "soft-delete" }
        }
      });
      return result;
    });
    return { deleted: true, softDeleted: true, tenant: updated };
  }

  async deleteDemoTenants() {
    throw new BadRequestException("Nettoyage global désactivé. Utilisez une suppression contrôlée sur une entreprise test dédiée.");
  }

  async logs() {
    const [auditLogs, securityLogs] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where: { entity: { startsWith: "PLATFORM" } }, orderBy: { createdAt: "desc" }, take: 60 }),
      this.prisma.securityLog.findMany({ where: { OR: [{ tenantId: null }, { metadata: { path: ["audience"], equals: "platform" } }] }, orderBy: { createdAt: "desc" }, take: 60 })
    ]);

    return [
      ...auditLogs.map((log) => ({ id: log.id, type: "Audit plateforme", tenantId: log.tenantId, tenantName: log.tenantName, user: log.userName ?? log.userEmail, action: log.action, message: log.message, createdAt: log.createdAt })),
      ...securityLogs.map((log) => ({ id: log.id, type: "Sécurité", tenantId: log.tenantId, tenantName: null, user: log.email, action: log.event, message: log.status, ipAddress: log.ipAddress, userAgent: log.userAgent, createdAt: log.createdAt }))
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 60);
  }

  private serializeTenantSummary(tenant: TenantWithAdminRelations, lastLogin?: SecurityLogSummary) {
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
      modules: tenant.businessModules?.filter((entry) => entry.isActive !== false).map((entry) => ({ key: entry.businessModule.key, name: entry.businessModule.name, category: entry.businessModule.category })) ?? [],
      users: tenant._count?.users ?? 0,
      licensesUsed: tenant._count?.users ?? 0,
      stores: tenant._count?.stores ?? 0,
      storesUsed: tenant._count?.stores ?? 0,
      warehouses: tenant._count?.warehouses ?? 0,
      storage: "Non mesuré",
      createdAt: tenant.createdAt
    };
  }

  private serializeSubscription(subscription: PlatformSubscription) {
    const plan = (subscription?.plan ?? SubscriptionPlan.FREE) as SubscriptionPlan;
    const planRecord = subscription && "planRecord" in subscription ? subscription.planRecord : null;
    return {
      plan,
      planCode: planRecord?.code ?? this.planCodeFor(plan),
      status: subscription?.status ?? SubscriptionStatus.TRIALING,
      startedAt: subscription?.startedAt ?? null,
      endsAt: subscription?.endsAt ?? null,
      trialStartedAt: subscription?.trialStartedAt ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodStart: subscription?.currentPeriodStart ?? subscription?.startedAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? subscription?.endsAt ?? null,
      monthlyPrice: PLAN_PRICES_HTG[plan],
      price: Number(subscription?.price ?? PLAN_PRICES_HTG[plan]),
      currency: subscription?.currency ?? "HTG",
      paymentStatus: subscription?.paymentStatus ?? "UNPAID",
      paymentReceived: subscription?.status === SubscriptionStatus.ACTIVE,
      paymentPending: subscription?.status === SubscriptionStatus.PAST_DUE,
      autoRenew: subscription?.status === SubscriptionStatus.ACTIVE,
      trial: subscription?.status === SubscriptionStatus.TRIALING
    };
  }

  private planCodeFor(plan: SubscriptionPlan) {
    if (plan === SubscriptionPlan.STARTER || plan === SubscriptionPlan.ESSENTIAL) return "ESSENTIAL";
    if (plan === SubscriptionPlan.PRO || plan === SubscriptionPlan.STANDARD) return "STANDARD";
    if (plan === SubscriptionPlan.ENTERPRISE || plan === SubscriptionPlan.EXPERT) return "EXPERT";
    return "TRIAL";
  }

  private async planRecordFor(plan: SubscriptionPlan) {
    await this.entitlements.ensureCatalogOnce();
    return this.prisma.plan.findUnique({ where: { code: this.planCodeFor(plan) } });
  }

  private async latestLoginsByTenant() {
    const logs = await this.prisma.securityLog.findMany({ where: { event: "LOGIN_SUCCESS", tenantId: { not: null } }, orderBy: { createdAt: "desc" }, take: 500 });
    const map = new Map<string, SecurityLogSummary>();
    for (const log of logs) if (log.tenantId && !map.has(log.tenantId)) map.set(log.tenantId, log);
    return map;
  }

  private async latestPendingPlanRequests(tenantIds: string[]) {
    if (!tenantIds.length) return new Map<string, { requestedPlanCode: string; requestedPlanName: string; createdAt: Date }>();
    const events = await this.prisma.subscriptionEvent.findMany({
      where: { tenantId: { in: tenantIds }, eventType: { in: ["PLAN_CHANGE_REQUESTED", "PLAN_CHANGE_CONFIRMED", "PLAN_CHANGE_REFUSED"] } },
      orderBy: { createdAt: "desc" },
      take: Math.max(tenantIds.length * 5, 20)
    });
    const map = new Map<string, { requestedPlanCode: string; requestedPlanName: string; createdAt: Date }>();
    const closed = new Set<string>();
    for (const event of events) {
      if (closed.has(event.tenantId) || map.has(event.tenantId)) continue;
      if (event.eventType !== "PLAN_CHANGE_REQUESTED") {
        closed.add(event.tenantId);
        continue;
      }
      const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) ? event.metadata as Record<string, unknown> : {};
      if (metadata.requestStatus === "PENDING") {
        map.set(event.tenantId, {
          requestedPlanCode: String(metadata.requestedPlanCode ?? ""),
          requestedPlanName: String(metadata.requestedPlanName ?? metadata.requestedPlanCode ?? ""),
          createdAt: event.createdAt
        });
      }
    }
    return map;
  }

  private customerTenantWhere(): Prisma.TenantWhereInput {
    return {
      status: { not: TenantStatus.DELETED },
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

  private async platformLoginSeries() {
    const logs = await this.prisma.securityLog.findMany({ where: { event: "LOGIN_SUCCESS", tenantId: null }, select: { createdAt: true } });
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

  private subscriptionRevenueSeries(subscriptions: Array<{ startedAt: Date; plan: SubscriptionPlan; status: SubscriptionStatus; price: Prisma.Decimal | number | null; currency: string }>) {
    const series = this.monthlySeries(subscriptions.map((subscription) => subscription.startedAt));
    return series.map((point) => ({
      ...point,
      value: subscriptions.filter((subscription) => `${subscription.startedAt.getFullYear()}-${String(subscription.startedAt.getMonth() + 1).padStart(2, "0")}` === point.key && subscription.status !== SubscriptionStatus.CANCELLED).reduce((sum, subscription) => sum + Number(subscription.price ?? PLAN_PRICES_HTG[subscription.plan]), 0)
    }));
  }

  private subscriptionRevenueByCurrency(subscriptions: Array<{ plan: SubscriptionPlan; price: Prisma.Decimal | number | null; currency: string }>) {
    const map = new Map<string, number>();
    for (const subscription of subscriptions) {
      const currency = subscription.currency ?? "HTG";
      map.set(currency, (map.get(currency) ?? 0) + Number(subscription.price ?? PLAN_PRICES_HTG[subscription.plan]));
    }
    return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
  }

  private activityBreakdown(tenants: Array<{ primaryActivity: string | null }>) {
    const map = new Map<string, number>();
    for (const tenant of tenants) {
      const activity = tenant.primaryActivity ?? "Non défini";
      map.set(activity, (map.get(activity) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }

  private isExpired(date?: Date | null) {
    return Boolean(date && date.getTime() < Date.now());
  }

  private async ensureTenantCanBeManaged(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, include: { users: { include: { roles: { include: { role: true } } } } } });
    if (!tenant) throw new NotFoundException("Entreprise introuvable");
    const hasPlatformAdmin = tenant.users.some((user) => user.roles.some((entry) => PLATFORM_ROLE_NAMES.includes(entry.role.name)));
    if (hasPlatformAdmin) throw new BadRequestException("Action interdite sur le tenant plateforme ou système.");
    return tenant;
  }

  private assertTenantTransition(current: TenantStatus, next: TenantStatus) {
    if (current === next) return;
    if (current === TenantStatus.DELETED) throw new BadRequestException("Entreprise supprimée: transition interdite.");
    if (!CUSTOMER_VISIBLE_STATUSES.includes(next) && next !== TenantStatus.DELETED) throw new BadRequestException("Statut non autorisé pour une entreprise cliente.");
    const allowed: Record<TenantStatus, TenantStatus[]> = {
      [TenantStatus.TRIAL]: [TenantStatus.ACTIVE, TenantStatus.PAUSED, TenantStatus.SUSPENDED, TenantStatus.EXPIRED, TenantStatus.DELETED],
      [TenantStatus.ACTIVE]: [TenantStatus.PAUSED, TenantStatus.SUSPENDED, TenantStatus.EXPIRED, TenantStatus.DELETED],
      [TenantStatus.PAUSED]: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.DELETED],
      [TenantStatus.SUSPENDED]: [TenantStatus.ACTIVE, TenantStatus.DELETED],
      [TenantStatus.EXPIRED]: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.DELETED],
      [TenantStatus.CANCELLED]: [TenantStatus.ACTIVE, TenantStatus.DELETED],
      [TenantStatus.DELETED]: []
    };
    if (!allowed[current]?.includes(next)) throw new BadRequestException(`Transition invalide: ${current} -> ${next}`);
  }

  private async writePlatformAudit(
    tenantId: string,
    tenantName: string,
    action: AuditAction,
    entity: string,
    message: string,
    extra: { userId?: string; oldValue?: Prisma.InputJsonValue; newValue?: Prisma.InputJsonValue; metadata?: Prisma.InputJsonValue } = {}
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        tenantName,
        action,
        entity,
        message,
        ...extra
      }
    });
  }
}

import { ForbiddenException, Injectable, OnModuleInit } from "@nestjs/common";
import { Prisma, SubscriptionPlan, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { defaultFeatures, defaultPlans, planFeatureMatrix, type SubscriptionFeatureKey } from "./subscription-features";

const inactiveStatuses = new Set<SubscriptionStatus>([
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.SUSPENDED,
  SubscriptionStatus.CANCELLED,
  SubscriptionStatus.CANCELED,
  SubscriptionStatus.EXPIRED
]);

type SubscriptionWithPlan = Prisma.TenantSubscriptionGetPayload<{
  include: { planRecord: { include: { features: { include: { feature: true } } } }, payments: { orderBy: { createdAt: "desc" }, take: 10 } };
}>;

@Injectable()
export class SubscriptionEntitlementsService implements OnModuleInit {
  private readonly cache = new Map<string, { expiresAt: number; entitlements: Awaited<ReturnType<SubscriptionEntitlementsService["buildEntitlements"]>> }>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureCatalog();
  }

  async ensureCatalog() {
    for (const plan of defaultPlans) {
      await this.prisma.plan.upsert({
        where: { code: plan.code },
        update: { name: plan.name, description: plan.description, monthlyPrice: plan.monthlyPrice, currency: plan.currency, trialDays: plan.trialDays, isActive: true, sortOrder: plan.sortOrder },
        create: { ...plan, isActive: true }
      });
    }

    for (const feature of defaultFeatures) {
      await this.prisma.feature.upsert({
        where: { key: feature.key },
        update: { name: feature.name, description: feature.description, category: feature.category },
        create: feature
      });
    }

    const [plans, features] = await Promise.all([this.prisma.plan.findMany(), this.prisma.feature.findMany()]);
    const featuresByKey = new Map(features.map((feature) => [feature.key, feature]));
    for (const plan of plans) {
      const enabledKeys = new Set(planFeatureMatrix[plan.code] ?? []);
      for (const feature of features) {
        await this.prisma.planFeature.upsert({
          where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
          update: { enabled: enabledKeys.has(feature.key as SubscriptionFeatureKey), limit: null },
          create: { id: `pf_${plan.code}_${feature.key}`, planId: plan.id, featureId: feature.id, enabled: enabledKeys.has(feature.key as SubscriptionFeatureKey) }
        });
      }
      if (plan.code === "TRIAL") continue;
      for (const key of planFeatureMatrix[plan.code] ?? []) {
        const feature = featuresByKey.get(key);
        if (!feature) continue;
        await this.prisma.planFeature.upsert({
          where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
          update: { enabled: true },
          create: { id: `pf_${plan.code}_${feature.key}`, planId: plan.id, featureId: feature.id, enabled: true }
        });
      }
    }
  }

  async createTrialSubscription(tx: Prisma.TransactionClient, tenantId: string, actorUserId?: string) {
    const plan = await tx.plan.findUnique({ where: { code: "TRIAL" } });
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subscription = await tx.tenantSubscription.create({
      data: {
        tenantId,
        plan: SubscriptionPlan.FREE,
        planId: plan?.id,
        status: SubscriptionStatus.TRIALING,
        price: 0,
        currency: "HTG",
        paymentStatus: "TRIAL",
        startedAt: now,
        endsAt: trialEndsAt,
        trialStartedAt: now,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt
      }
    });
    await tx.subscriptionEvent.create({
      data: { tenantId, subscriptionId: subscription.id, actorUserId, eventType: "TRIAL_STARTED", newStatus: SubscriptionStatus.TRIALING, metadata: { planCode: "TRIAL", trialDays: 30 } }
    });
    return subscription;
  }

  async getSubscription(tenantId: string) {
    await this.ensureCatalog();
    let subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { planRecord: { include: { features: { include: { feature: true } } } }, payments: { orderBy: { createdAt: "desc" }, take: 10 } }
    });
    if (!subscription) subscription = await this.createMissingTrial(tenantId);
    return this.recalculateStatus(subscription);
  }

  async getEntitlements(tenantId: string) {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.entitlements;
    const subscription = await this.getSubscription(tenantId);
    const entitlements = this.buildEntitlements(subscription);
    this.cache.set(tenantId, { expiresAt: Date.now() + 30_000, entitlements });
    return entitlements;
  }

  async hasFeature(tenantId: string, featureKey: SubscriptionFeatureKey) {
    const entitlements = await this.getEntitlements(tenantId);
    return entitlements.isActive && entitlements.features.some((feature) => feature.key === featureKey && feature.enabled);
  }

  async assertFeature(tenantId: string, featureKey: SubscriptionFeatureKey) {
    const entitlements = await this.getEntitlements(tenantId);
    if (!entitlements.isActive) {
      throw new ForbiddenException({ code: "SUBSCRIPTION_INACTIVE", status: entitlements.status, message: "Votre abonnement n'est pas actif." });
    }
    const included = entitlements.features.some((feature) => feature.key === featureKey && feature.enabled);
    if (!included) {
      throw new ForbiddenException({ code: "FEATURE_NOT_INCLUDED", featureKey, planCode: entitlements.planCode, message: `Cette fonctionnalité est disponible avec un autre plan.` });
    }
  }

  async assertSubscriptionActive(tenantId: string) {
    const entitlements = await this.getEntitlements(tenantId);
    if (!entitlements.isActive) {
      throw new ForbiddenException({ code: "SUBSCRIPTION_INACTIVE", status: entitlements.status, message: "Votre abonnement n'est pas actif." });
    }
  }

  invalidate(tenantId: string) {
    this.cache.delete(tenantId);
  }

  async listPlans() {
    await this.ensureCatalog();
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: { features: { include: { feature: true }, orderBy: { feature: { category: "asc" } } } },
      orderBy: { sortOrder: "asc" }
    });
    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      monthlyPrice: Number(plan.monthlyPrice),
      currency: plan.currency,
      trialDays: plan.trialDays,
      features: plan.features.map((entry) => ({ key: entry.feature.key, name: entry.feature.name, category: entry.feature.category, enabled: entry.enabled, limit: entry.limit }))
    }));
  }

  private async createMissingTrial(tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenantSubscription.findUnique({ where: { tenantId }, include: { planRecord: { include: { features: { include: { feature: true } } } }, payments: { orderBy: { createdAt: "desc" }, take: 10 } } });
      if (existing) return existing;
      await this.createTrialSubscription(tx, tenantId);
      const created = await tx.tenantSubscription.findUniqueOrThrow({ where: { tenantId }, include: { planRecord: { include: { features: { include: { feature: true } } } }, payments: { orderBy: { createdAt: "desc" }, take: 10 } } });
      return created;
    });
  }

  private async recalculateStatus(subscription: SubscriptionWithPlan) {
    const now = new Date();
    const end = subscription.currentPeriodEnd ?? subscription.trialEndsAt ?? subscription.endsAt;
    if (subscription.status === SubscriptionStatus.TRIALING && end && end.getTime() < now.getTime()) {
      const updated = await this.prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED, paymentStatus: "EXPIRED" },
        include: { planRecord: { include: { features: { include: { feature: true } } } }, payments: { orderBy: { createdAt: "desc" }, take: 10 } }
      });
      await this.prisma.tenant.update({ where: { id: subscription.tenantId }, data: { status: TenantStatus.EXPIRED } }).catch(() => undefined);
      await this.prisma.subscriptionEvent.create({ data: { tenantId: subscription.tenantId, subscriptionId: subscription.id, eventType: "SUBSCRIPTION_EXPIRED", previousStatus: subscription.status, newStatus: SubscriptionStatus.EXPIRED } }).catch(() => undefined);
      this.invalidate(subscription.tenantId);
      return updated;
    }
    return subscription;
  }

  private buildEntitlements(subscription: SubscriptionWithPlan) {
    const planCode = subscription.planRecord?.code ?? this.legacyPlanCode(subscription.plan);
    const features = subscription.planRecord?.features.map((entry) => ({
      key: entry.feature.key,
      name: entry.feature.name,
      category: entry.feature.category,
      enabled: entry.enabled,
      limit: entry.limit
    })) ?? (planFeatureMatrix[planCode] ?? []).map((key) => ({ key, name: key, category: "Legacy", enabled: true, limit: null }));
    const end = subscription.currentPeriodEnd ?? subscription.trialEndsAt ?? subscription.endsAt;
    const isActive = !inactiveStatuses.has(subscription.status) && (!end || end.getTime() >= Date.now());
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planCode,
      legacyPlan: subscription.plan,
      planName: subscription.planRecord?.name ?? planCode,
      status: subscription.status,
      isActive,
      trialStartedAt: subscription.trialStartedAt,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart ?? subscription.startedAt,
      currentPeriodEnd: end,
      daysRemaining: end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null,
      price: Number(subscription.price),
      currency: subscription.currency,
      features,
      payments: subscription.payments.map((payment) => ({ id: payment.id, amount: Number(payment.amount), currency: payment.currency, status: payment.status, provider: payment.provider, periodStart: payment.periodStart, periodEnd: payment.periodEnd, paidAt: payment.paidAt, createdAt: payment.createdAt }))
    };
  }

  private legacyPlanCode(plan: SubscriptionPlan) {
    if (plan === SubscriptionPlan.STARTER || plan === SubscriptionPlan.ESSENTIAL) return "ESSENTIAL";
    if (plan === SubscriptionPlan.PRO || plan === SubscriptionPlan.STANDARD) return "STANDARD";
    if (plan === SubscriptionPlan.ENTERPRISE || plan === SubscriptionPlan.EXPERT) return "EXPERT";
    return "TRIAL";
  }
}

import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AppStoreServerAPIClient, Environment, SignedDataVerifier, Status, Type } from "@apple/app-store-server-library";
import { readFileSync } from "fs";
import { SubscriptionPlan, SubscriptionStatus, TenantStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionEntitlementsService } from "./subscription-entitlements.service";
import { appleAccountToken, appleProducts } from "./apple-products";
import type { AuthUser } from "../auth/types/auth-user";

@Injectable()
export class AppleSubscriptionsService {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: SubscriptionEntitlementsService) {}

  private configuration() {
    const required = ["APPLE_IAP_KEY_ID", "APPLE_IAP_ISSUER_ID", "APPLE_IAP_ENVIRONMENT"];
    if (process.env.APPLE_IAP_ENABLED !== "true" || required.some(key => !process.env[key])) return null;
    if ((!process.env.APPLE_IAP_PRIVATE_KEY_BASE64 && !process.env.APPLE_IAP_KEY_PATH) ||
        (!process.env.APPLE_IAP_ROOT_CA_BASE64 && !process.env.APPLE_IAP_ROOT_CA_PATH)) return null;
    const environment = process.env.APPLE_IAP_ENVIRONMENT === "Production" ? Environment.PRODUCTION
      : process.env.APPLE_IAP_ENVIRONMENT === "Sandbox" ? Environment.SANDBOX : null;
    if (!environment) return null;
    const bundleId = "com.vtaerp.pos";
    return {
      environment,
      verifier: new SignedDataVerifier([process.env.APPLE_IAP_ROOT_CA_BASE64 ? Buffer.from(process.env.APPLE_IAP_ROOT_CA_BASE64, "base64") : readFileSync(process.env.APPLE_IAP_ROOT_CA_PATH!)], true, environment, bundleId, 6826297355),
      client: new AppStoreServerAPIClient(process.env.APPLE_IAP_PRIVATE_KEY_BASE64 ? Buffer.from(process.env.APPLE_IAP_PRIVATE_KEY_BASE64, "base64").toString("utf8") : readFileSync(process.env.APPLE_IAP_KEY_PATH!, "utf8"), process.env.APPLE_IAP_KEY_ID!, process.env.APPLE_IAP_ISSUER_ID!, bundleId, environment)
    };
  }

  private assertOwner(user: AuthUser) {
    if (![user.role, ...(user.roles ?? [])].some(role => ["owner", "propriétaire"].includes(role.toLowerCase()))) {
      throw new ForbiddenException("Seul le propriétaire peut gérer l’abonnement de l’entreprise.");
    }
  }

  async catalog(user: AuthUser) {
    const canManage = [user.role, ...(user.roles ?? [])].some(role => ["owner", "propriétaire"].includes(role.toLowerCase()));
    let configured = false;
    try {
      configured = Boolean(this.configuration());
      if (configured) await this.prisma.appleSubscriptionPurchase.findFirst({ select: { originalTransactionId: true } });
    } catch { configured = false; /* Missing deployment configuration or migration: never offer a charge. */ }
    const subscription = await this.entitlements.getEntitlements(user.tenantId);
    const trialActive = subscription.planCode === "TRIAL" && subscription.isActive;
    return { configured: configured && canManage, canManage, canPurchase: configured && canManage && !trialActive, trialActive, appAccountToken: appleAccountToken(user.tenantId), products: Object.entries(appleProducts).map(([id, planCode]) => ({ id, planCode })) };
  }

  async verify(user: AuthUser, signedTransaction: string) {
    this.assertOwner(user);
    const config = this.configuration();
    if (!config) throw new ServiceUnavailableException("Les abonnements Apple ne sont pas encore disponibles.");
    if (typeof signedTransaction !== "string" || signedTransaction.length > 25000) throw new BadRequestException("Transaction invalide.");
    let decoded;
    try { decoded = await config.verifier.verifyAndDecodeTransaction(signedTransaction); }
    catch { throw new BadRequestException("Transaction Apple non vérifiée."); }
    if (decoded.appAccountToken?.toLowerCase() !== appleAccountToken(user.tenantId)) throw new ForbiddenException("Cet achat appartient à une autre entreprise.");
    if (!decoded.originalTransactionId) throw new BadRequestException("Référence Apple absente.");
    await this.synchronize(user.tenantId, decoded.originalTransactionId);
    return this.entitlements.getEntitlements(user.tenantId);
  }

  async notification(signedPayload: string) {
    const config = this.configuration();
    if (!config) throw new ServiceUnavailableException("Apple non configuré.");
    if (typeof signedPayload !== "string" || signedPayload.length > 80000) throw new BadRequestException("Notification invalide.");
    let notification;
    try { notification = await config.verifier.verifyAndDecodeNotification(signedPayload); }
    catch { throw new BadRequestException("Signature Apple invalide."); }
    if (!notification.data?.signedTransactionInfo) return { received: true };
    const transaction = await config.verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo);
    const purchase = transaction.originalTransactionId ? await this.prisma.appleSubscriptionPurchase.findUnique({ where: { originalTransactionId: transaction.originalTransactionId } }) : null;
    // An unknown notification must never claim a business on its own.
    if (purchase) await this.synchronize(purchase.tenantId, purchase.originalTransactionId);
    return { received: true };
  }

  async synchronize(tenantId: string, originalTransactionId: string) {
    const config = this.configuration();
    if (!config) throw new ServiceUnavailableException("Apple non configuré.");
    // Always fetch Apple's current state: an old signed receipt cannot undo a refund.
    const response = await config.client.getAllSubscriptionStatuses(originalTransactionId);
    const entry = response.data?.flatMap(group => group.lastTransactions ?? []).find(item => item.originalTransactionId === originalTransactionId);
    if (!entry?.signedTransactionInfo) throw new BadRequestException("Abonnement Apple introuvable.");
    const transaction = await config.verifier.verifyAndDecodeTransaction(entry.signedTransactionInfo);
    const renewal = entry.signedRenewalInfo ? await config.verifier.verifyAndDecodeRenewalInfo(entry.signedRenewalInfo) : null;
    if (transaction.appAccountToken?.toLowerCase() !== appleAccountToken(tenantId) || transaction.originalTransactionId !== originalTransactionId || transaction.type !== Type.AUTO_RENEWABLE_SUBSCRIPTION || !transaction.productId || !appleProducts[transaction.productId] || !transaction.transactionId || !transaction.signedDate || !transaction.expiresDate) {
      throw new ForbiddenException("Abonnement incompatible avec cette entreprise.");
    }
    const end = entry.status === Status.BILLING_GRACE_PERIOD && renewal?.gracePeriodExpiresDate ? renewal.gracePeriodExpiresDate : transaction.expiresDate;
    const active = !transaction.revocationDate && [Status.ACTIVE, Status.BILLING_GRACE_PERIOD].includes(entry.status as Status) && end > Date.now();
    const planCode = active ? appleProducts[transaction.productId] : "POS_FREE";
    await this.entitlements.ensureCatalogOnce();
    await this.prisma.$transaction(async tx => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      if (![TenantStatus.ACTIVE, TenantStatus.TRIAL, TenantStatus.EXPIRED].includes(tenant.status as typeof TenantStatus.ACTIVE)) throw new ForbiddenException("Entreprise suspendue ou indisponible.");
      const existing = await tx.appleSubscriptionPurchase.findUnique({ where: { originalTransactionId } });
      if (existing && (existing.tenantId !== tenantId || existing.environment !== config.environment)) throw new ForbiddenException("Achat déjà associé à une autre entreprise.");
      if (existing && existing.signedAt.getTime() > transaction.signedDate!) return;
      const current = await tx.tenantSubscription.findUniqueOrThrow({ where: { tenantId } });
      if (current.paymentStatus === "APPLE" && current.currentPeriodStart && transaction.purchaseDate && current.currentPeriodStart.getTime() > transaction.purchaseDate) return;
      // Notifications from a former Apple purchase cannot downgrade a newer manual plan.
      if (!active && current.paymentStatus !== "APPLE" && current.paymentStatus !== "APPLE_FREE") return;
      const plan = await tx.plan.findUniqueOrThrow({ where: { code: planCode } });
      await tx.appleSubscriptionPurchase.upsert({ where: { originalTransactionId },
        create: { originalTransactionId, tenantId, environment: config.environment, productId: transaction.productId!, transactionId: transaction.transactionId!, signedAt: new Date(transaction.signedDate!), expiresAt: new Date(end) },
        update: { productId: transaction.productId!, transactionId: transaction.transactionId!, signedAt: new Date(transaction.signedDate!), expiresAt: new Date(end) } });
      await tx.tenantSubscription.update({ where: { tenantId }, data: {
        planId: plan.id, plan: planCode === "POS_PRO" ? SubscriptionPlan.EXPERT : planCode === "POS_PREMIUM" ? SubscriptionPlan.STANDARD : planCode === "POS_BASIC" ? SubscriptionPlan.ESSENTIAL : SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE, paymentStatus: active ? "APPLE" : "APPLE_FREE", price: plan.monthlyPrice, currency: plan.currency,
        endsAt: active ? new Date(end) : null, currentPeriodEnd: active ? new Date(end) : null,
        currentPeriodStart: new Date(transaction.purchaseDate ?? Date.now())
      } });
      await tx.tenant.update({ where: { id: tenantId }, data: { status: TenantStatus.ACTIVE } });
      if (existing?.transactionId !== transaction.transactionId || current.planId !== plan.id) await tx.subscriptionEvent.create({ data: { tenantId, subscriptionId: current.id, eventType: "APPLE_SUBSCRIPTION_SYNCED", newStatus: SubscriptionStatus.ACTIVE, metadata: { planCode, transactionId: transaction.transactionId, environment: config.environment, active } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    this.entitlements.invalidate(tenantId);
  }
}

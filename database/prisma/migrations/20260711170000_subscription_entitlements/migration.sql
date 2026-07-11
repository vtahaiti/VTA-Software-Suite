ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'ESSENTIAL';
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'STANDARD';
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'EXPERT';

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'GRACE_PERIOD';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TABLE IF NOT EXISTS "Plan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "monthlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'HTG',
  "trialDays" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Feature" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlanFeature" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "limit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "previousStatus" "SubscriptionStatus",
  "newStatus" "SubscriptionStatus",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'HTG',
  "status" TEXT NOT NULL DEFAULT 'UNPAID',
  "provider" TEXT NOT NULL DEFAULT 'MANUAL',
  "providerReference" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Plan_code_key" ON "Plan"("code");
CREATE INDEX IF NOT EXISTS "Plan_isActive_idx" ON "Plan"("isActive");
CREATE INDEX IF NOT EXISTS "Plan_sortOrder_idx" ON "Plan"("sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "Feature_key_key" ON "Feature"("key");
CREATE INDEX IF NOT EXISTS "Feature_category_idx" ON "Feature"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanFeature_planId_featureId_key" ON "PlanFeature"("planId", "featureId");
CREATE INDEX IF NOT EXISTS "PlanFeature_planId_idx" ON "PlanFeature"("planId");
CREATE INDEX IF NOT EXISTS "PlanFeature_featureId_idx" ON "PlanFeature"("featureId");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_tenantId_idx" ON "SubscriptionEvent"("tenantId");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_eventType_idx" ON "SubscriptionEvent"("eventType");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_createdAt_idx" ON "SubscriptionEvent"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPayment_provider_providerReference_key" ON "SubscriptionPayment"("provider", "providerReference");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_paidAt_idx" ON "SubscriptionPayment"("paidAt");
CREATE INDEX IF NOT EXISTS "TenantSubscription_planId_idx" ON "TenantSubscription"("planId");
CREATE INDEX IF NOT EXISTS "TenantSubscription_status_idx" ON "TenantSubscription"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanFeature_planId_fkey') THEN
    ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanFeature_featureId_fkey') THEN
    ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantSubscription_planId_fkey') THEN
    ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionEvent_tenantId_fkey') THEN
    ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionEvent_subscriptionId_fkey') THEN
    ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionPayment_tenantId_fkey') THEN
    ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionPayment_subscriptionId_fkey') THEN
    ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Plan" ("id", "code", "name", "description", "monthlyPrice", "currency", "trialDays", "isActive", "sortOrder")
VALUES
  ('plan_trial', 'TRIAL', 'Essai gratuit', 'Essai de 30 jours avec toutes les fonctionnalités activées.', 0, 'HTG', 30, true, 0),
  ('plan_essential', 'ESSENTIAL', 'Essentiel', 'Fonctionnalités essentielles de VTA Commerce.', 1000, 'HTG', 0, true, 10),
  ('plan_standard', 'STANDARD', 'Standard', 'Fonctionnalités commerciales avancées.', 2000, 'HTG', 0, true, 20),
  ('plan_expert', 'EXPERT', 'Expert', 'Toutes les fonctionnalités avancées et le mode expert.', 4000, 'HTG', 0, true, 30)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "currency" = EXCLUDED."currency",
  "trialDays" = EXCLUDED."trialDays",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Feature" ("id", "key", "name", "description", "category")
VALUES
  ('feature_pos', 'POS', 'POS', 'Vente rapide et encaissement.', 'Ventes'),
  ('feature_products', 'PRODUCTS', 'Produits', 'Gestion des produits.', 'Catalogue'),
  ('feature_categories', 'CATEGORIES', 'Catégories', 'Gestion des catégories.', 'Catalogue'),
  ('feature_inventory', 'INVENTORY', 'Inventaire', 'Stock et mouvements.', 'Stock'),
  ('feature_customers', 'CUSTOMERS', 'Clients', 'Gestion des clients.', 'CRM'),
  ('feature_suppliers', 'SUPPLIERS', 'Fournisseurs', 'Gestion des fournisseurs.', 'Achats'),
  ('feature_purchases', 'PURCHASES', 'Achats', 'Commandes et réceptions.', 'Achats'),
  ('feature_sales_history', 'SALES_HISTORY', 'Historique des ventes', 'Consultation des ventes terminées.', 'Ventes'),
  ('feature_held_sales', 'HELD_SALES', 'Ventes en attente', 'Brouillons et ventes en attente.', 'Ventes'),
  ('feature_basic_reports', 'BASIC_REPORTS', 'Rapports de base', 'Indicateurs essentiels.', 'Rapports'),
  ('feature_advanced_reports', 'ADVANCED_REPORTS', 'Rapports avancés', 'Rapports financiers et analytiques.', 'Rapports'),
  ('feature_users', 'USERS', 'Utilisateurs', 'Gestion des utilisateurs.', 'Administration'),
  ('feature_roles_permissions', 'ROLES_PERMISSIONS', 'Rôles et permissions', 'Gestion avancée des accès.', 'Administration'),
  ('feature_email_receipts', 'EMAIL_RECEIPTS', 'Reçus par email', 'Envoi de reçus et notifications.', 'Emails'),
  ('feature_quotes', 'QUOTES', 'Devis', 'Création de devis.', 'Ventes'),
  ('feature_orders', 'ORDERS', 'Commandes', 'Création de commandes.', 'Ventes'),
  ('feature_multi_payment', 'MULTI_PAYMENT', 'Paiements multiples', 'Plusieurs moyens de paiement.', 'Paiements'),
  ('feature_advanced_taxes', 'ADVANCED_TAXES', 'Taxes avancées', 'Gestion avancée des taxes.', 'Facturation'),
  ('feature_multi_store', 'MULTI_STORE', 'Multi-magasin', 'Gestion de plusieurs magasins.', 'Structure'),
  ('feature_multi_warehouse', 'MULTI_WAREHOUSE', 'Multi-dépôt', 'Gestion de plusieurs dépôts.', 'Structure'),
  ('feature_thermal_printing', 'THERMAL_PRINTING', 'Impression thermique', 'Tickets 58 mm et 80 mm.', 'Impression'),
  ('feature_letter_report_printing', 'LETTER_REPORT_PRINTING', 'Rapports Letter', 'Impression de rapports Letter.', 'Impression'),
  ('feature_expert_mode', 'EXPERT_MODE', 'Mode expert', 'Accès au mode expert.', 'Administration')
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanFeature" ("id", "planId", "featureId", "enabled", "limit")
SELECT 'pf_' || p."code" || '_' || f."key", p."id", f."id",
  CASE
    WHEN p."code" IN ('TRIAL', 'EXPERT') THEN true
    WHEN p."code" = 'STANDARD' THEN f."key" IN ('POS','PRODUCTS','CATEGORIES','INVENTORY','CUSTOMERS','SUPPLIERS','PURCHASES','SALES_HISTORY','HELD_SALES','BASIC_REPORTS','ADVANCED_REPORTS','USERS','EMAIL_RECEIPTS','QUOTES','ORDERS','MULTI_PAYMENT','THERMAL_PRINTING','LETTER_REPORT_PRINTING')
    WHEN p."code" = 'ESSENTIAL' THEN f."key" IN ('POS','PRODUCTS','CATEGORIES','INVENTORY','CUSTOMERS','SALES_HISTORY','HELD_SALES','BASIC_REPORTS','THERMAL_PRINTING')
    ELSE false
  END,
  NULL
FROM "Plan" p
CROSS JOIN "Feature" f
WHERE p."code" IN ('TRIAL', 'ESSENTIAL', 'STANDARD', 'EXPERT')
ON CONFLICT ("planId", "featureId") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "limit" = EXCLUDED."limit",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "TenantSubscription"
SET
  "planId" = CASE
    WHEN "plan" = 'FREE' THEN 'plan_trial'
    WHEN "plan" = 'STARTER' THEN 'plan_essential'
    WHEN "plan" = 'PRO' THEN 'plan_standard'
    WHEN "plan" = 'ENTERPRISE' THEN 'plan_expert'
    ELSE "planId"
  END,
  "trialStartedAt" = COALESCE("trialStartedAt", CASE WHEN "status" = 'TRIALING' THEN "startedAt" ELSE NULL END),
  "trialEndsAt" = COALESCE("trialEndsAt", CASE WHEN "status" = 'TRIALING' THEN COALESCE("endsAt", "startedAt" + INTERVAL '30 days') ELSE NULL END),
  "currentPeriodStart" = COALESCE("currentPeriodStart", "startedAt"),
  "currentPeriodEnd" = COALESCE("currentPeriodEnd", "endsAt");

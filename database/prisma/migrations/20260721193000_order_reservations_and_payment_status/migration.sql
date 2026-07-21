-- Devis & Commandes V1 - additive safety migration.
-- Keeps existing quotes, orders, invoices, POS sales and stock history intact.

ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_DELIVERY';
ALTER TYPE "SalesDocumentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalesDocumentPaymentStatus') THEN
    CREATE TYPE "SalesDocumentPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');
  END IF;
END $$;

ALTER TABLE "Quote"
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "terms" TEXT,
  ADD COLUMN IF NOT EXISTS "customerSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "companySnapshot" JSONB;

ALTER TABLE "Proforma"
  ADD COLUMN IF NOT EXISTS "warehouseId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentStatus" "SalesDocumentPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "customerSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "companySnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "quoteSnapshot" JSONB;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT;

UPDATE "Proforma"
SET "paymentStatus" = CASE
  WHEN "status" = 'PAID' THEN 'PAID'::"SalesDocumentPaymentStatus"
  WHEN "status" = 'PARTIALLY_PAID' THEN 'PARTIALLY_PAID'::"SalesDocumentPaymentStatus"
  WHEN "balance" <= 0 AND "total" > 0 THEN 'PAID'::"SalesDocumentPaymentStatus"
  WHEN "paidAmount" > 0 THEN 'PARTIALLY_PAID'::"SalesDocumentPaymentStatus"
  ELSE 'UNPAID'::"SalesDocumentPaymentStatus"
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Proforma_warehouseId_fkey'
  ) THEN
    ALTER TABLE "Proforma"
      ADD CONSTRAINT "Proforma_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StockReservation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "proformaId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockReservation_tenantId_fkey') THEN
    ALTER TABLE "StockReservation"
      ADD CONSTRAINT "StockReservation_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockReservation_proformaId_fkey') THEN
    ALTER TABLE "StockReservation"
      ADD CONSTRAINT "StockReservation_proformaId_fkey"
      FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockReservation_productId_fkey') THEN
    ALTER TABLE "StockReservation"
      ADD CONSTRAINT "StockReservation_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockReservation_warehouseId_fkey') THEN
    ALTER TABLE "StockReservation"
      ADD CONSTRAINT "StockReservation_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Quote_expiresAt_idx" ON "Quote"("expiresAt");
CREATE INDEX IF NOT EXISTS "Proforma_warehouseId_idx" ON "Proforma"("warehouseId");
CREATE INDEX IF NOT EXISTS "Proforma_paymentStatus_idx" ON "Proforma"("paymentStatus");
CREATE INDEX IF NOT EXISTS "Payment_createdById_idx" ON "Payment"("createdById");
CREATE INDEX IF NOT EXISTS "StockReservation_tenantId_idx" ON "StockReservation"("tenantId");
CREATE INDEX IF NOT EXISTS "StockReservation_proformaId_idx" ON "StockReservation"("proformaId");
CREATE INDEX IF NOT EXISTS "StockReservation_productId_idx" ON "StockReservation"("productId");
CREATE INDEX IF NOT EXISTS "StockReservation_warehouseId_idx" ON "StockReservation"("warehouseId");

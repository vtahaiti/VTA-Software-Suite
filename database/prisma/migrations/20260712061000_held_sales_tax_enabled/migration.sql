ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "taxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantSettings" ALTER COLUMN "defaultTaxRate" SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS "HeldSale" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "customerId" TEXT,
  "storeId" TEXT,
  "warehouseId" TEXT,
  "cashSessionId" TEXT,
  "cart" JSONB NOT NULL,
  "payments" JSONB,
  "orderDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HeldSale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HeldSale_tenantId_updatedAt_idx" ON "HeldSale"("tenantId", "updatedAt");
CREATE INDEX IF NOT EXISTS "HeldSale_tenantId_userId_idx" ON "HeldSale"("tenantId", "userId");
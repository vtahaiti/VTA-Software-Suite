DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PhysicalInventoryStatus') THEN
    CREATE TYPE "PhysicalInventoryStatus" AS ENUM ('DRAFT', 'VALIDATED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockAlertType') THEN
    CREATE TYPE "StockAlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRING_SOON', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockAlertStatus') THEN
    CREATE TYPE "StockAlertStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
  END IF;
END $$;

ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;

CREATE TABLE IF NOT EXISTS "PhysicalInventory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "storeId" TEXT,
  "number" TEXT NOT NULL,
  "status" "PhysicalInventoryStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdById" TEXT,
  "validatedById" TEXT,
  "validatedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhysicalInventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PhysicalInventoryItem" (
  "id" TEXT NOT NULL,
  "physicalInventoryId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "systemQty" INTEGER NOT NULL,
  "physicalQty" INTEGER NOT NULL,
  "difference" INTEGER NOT NULL,
  "barcode" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhysicalInventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockAlert" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "storeId" TEXT,
  "type" "StockAlertType" NOT NULL,
  "status" "StockAlertStatus" NOT NULL DEFAULT 'OPEN',
  "message" TEXT NOT NULL,
  "quantity" INTEGER,
  "threshold" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PhysicalInventory_tenantId_number_key" ON "PhysicalInventory"("tenantId", "number");
CREATE INDEX IF NOT EXISTS "PhysicalInventory_tenantId_idx" ON "PhysicalInventory"("tenantId");
CREATE INDEX IF NOT EXISTS "PhysicalInventory_warehouseId_idx" ON "PhysicalInventory"("warehouseId");
CREATE INDEX IF NOT EXISTS "PhysicalInventory_storeId_idx" ON "PhysicalInventory"("storeId");
CREATE INDEX IF NOT EXISTS "PhysicalInventory_status_idx" ON "PhysicalInventory"("status");
CREATE INDEX IF NOT EXISTS "PhysicalInventoryItem_physicalInventoryId_idx" ON "PhysicalInventoryItem"("physicalInventoryId");
CREATE INDEX IF NOT EXISTS "PhysicalInventoryItem_productId_idx" ON "PhysicalInventoryItem"("productId");
CREATE INDEX IF NOT EXISTS "StockAlert_tenantId_idx" ON "StockAlert"("tenantId");
CREATE INDEX IF NOT EXISTS "StockAlert_productId_idx" ON "StockAlert"("productId");
CREATE INDEX IF NOT EXISTS "StockAlert_warehouseId_idx" ON "StockAlert"("warehouseId");
CREATE INDEX IF NOT EXISTS "StockAlert_storeId_idx" ON "StockAlert"("storeId");
CREATE INDEX IF NOT EXISTS "StockAlert_type_idx" ON "StockAlert"("type");
CREATE INDEX IF NOT EXISTS "StockAlert_status_idx" ON "StockAlert"("status");
CREATE INDEX IF NOT EXISTS "StockAlert_createdAt_idx" ON "StockAlert"("createdAt");
CREATE INDEX IF NOT EXISTS "InventoryMovement_userId_idx" ON "InventoryMovement"("userId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_storeId_idx" ON "InventoryMovement"("storeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PhysicalInventoryItem_physicalInventoryId_fkey') THEN
    ALTER TABLE "PhysicalInventoryItem" ADD CONSTRAINT "PhysicalInventoryItem_physicalInventoryId_fkey" FOREIGN KEY ("physicalInventoryId") REFERENCES "PhysicalInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- Shalom Windows manufacturing V1. Additive only: existing quotes, orders, payments and stock
-- movements remain untouched and manufacturing orders are created explicitly by users.
CREATE TYPE "ManufacturingOrderStatus" AS ENUM ('DRAFT', 'TO_PREPARE', 'IN_PRODUCTION', 'READY', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ManufacturingPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "ManufacturingOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "manufacturingNumber" TEXT NOT NULL,
  "proformaId" TEXT NOT NULL,
  "customerId" TEXT,
  "warehouseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "ManufacturingOrderStatus" NOT NULL DEFAULT 'TO_PREPARE',
  "priority" "ManufacturingPriority" NOT NULL DEFAULT 'NORMAL',
  "expectedDate" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "assignedToId" TEXT,
  "instructions" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManufacturingOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManufacturingOrderItem" (
  "id" TEXT NOT NULL,
  "manufacturingOrderId" TEXT NOT NULL,
  "proformaItemId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "width" DECIMAL(12,3),
  "height" DECIMAL(12,3),
  "length" DECIMAL(12,3),
  "dimensionUnit" TEXT NOT NULL DEFAULT 'cm',
  "workType" TEXT,
  "material" TEXT,
  "color" TEXT,
  "glassType" TEXT,
  "instructions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManufacturingOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManufacturingMaterial" (
  "id" TEXT NOT NULL,
  "manufacturingOrderId" TEXT NOT NULL,
  "manufacturingItemId" TEXT,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "requiredQuantity" DECIMAL(14,3) NOT NULL,
  "reservedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "consumedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "wasteQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL,
  "unitCost" DECIMAL(14,2),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManufacturingMaterial_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryMovement" ADD COLUMN "manufacturingOrderId" TEXT;
ALTER TABLE "StockReservation" ADD COLUMN "manufacturingOrderId" TEXT;
ALTER TABLE "StockReservation" ADD COLUMN "manufacturingMaterialId" TEXT;

CREATE UNIQUE INDEX "ManufacturingOrder_proformaId_key" ON "ManufacturingOrder"("proformaId");
CREATE UNIQUE INDEX "ManufacturingOrder_tenantId_manufacturingNumber_key" ON "ManufacturingOrder"("tenantId", "manufacturingNumber");
CREATE INDEX "ManufacturingOrder_tenantId_status_idx" ON "ManufacturingOrder"("tenantId", "status");
CREATE INDEX "ManufacturingOrder_tenantId_expectedDate_idx" ON "ManufacturingOrder"("tenantId", "expectedDate");
CREATE INDEX "ManufacturingOrder_customerId_idx" ON "ManufacturingOrder"("customerId");
CREATE INDEX "ManufacturingOrder_warehouseId_idx" ON "ManufacturingOrder"("warehouseId");
CREATE INDEX "ManufacturingOrder_assignedToId_idx" ON "ManufacturingOrder"("assignedToId");
CREATE INDEX "ManufacturingOrderItem_manufacturingOrderId_idx" ON "ManufacturingOrderItem"("manufacturingOrderId");
CREATE INDEX "ManufacturingOrderItem_proformaItemId_idx" ON "ManufacturingOrderItem"("proformaItemId");
CREATE INDEX "ManufacturingMaterial_manufacturingOrderId_idx" ON "ManufacturingMaterial"("manufacturingOrderId");
CREATE INDEX "ManufacturingMaterial_manufacturingItemId_idx" ON "ManufacturingMaterial"("manufacturingItemId");
CREATE INDEX "ManufacturingMaterial_productId_idx" ON "ManufacturingMaterial"("productId");
CREATE INDEX "ManufacturingMaterial_warehouseId_idx" ON "ManufacturingMaterial"("warehouseId");
CREATE INDEX "InventoryMovement_manufacturingOrderId_idx" ON "InventoryMovement"("manufacturingOrderId");
CREATE INDEX "StockReservation_manufacturingOrderId_idx" ON "StockReservation"("manufacturingOrderId");
CREATE INDEX "StockReservation_manufacturingMaterialId_idx" ON "StockReservation"("manufacturingMaterialId");

ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManufacturingOrderItem" ADD CONSTRAINT "ManufacturingOrderItem_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManufacturingOrderItem" ADD CONSTRAINT "ManufacturingOrderItem_proformaItemId_fkey" FOREIGN KEY ("proformaItemId") REFERENCES "ProformaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManufacturingMaterial" ADD CONSTRAINT "ManufacturingMaterial_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManufacturingMaterial" ADD CONSTRAINT "ManufacturingMaterial_manufacturingItemId_fkey" FOREIGN KEY ("manufacturingItemId") REFERENCES "ManufacturingOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManufacturingMaterial" ADD CONSTRAINT "ManufacturingMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManufacturingMaterial" ADD CONSTRAINT "ManufacturingMaterial_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_manufacturingMaterialId_fkey" FOREIGN KEY ("manufacturingMaterialId") REFERENCES "ManufacturingMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupplierInvoiceStatus') THEN
    CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupplierPaymentMethod') THEN
    CREATE TYPE "SupplierPaymentMethod" AS ENUM ('CASH', 'CREDIT', 'CARD', 'BANK_TRANSFER', 'MIXED');
  END IF;
END $$;

ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "taxNumber" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'HTG';

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "SupplierInvoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseOrderId" TEXT,
  "number" TEXT NOT NULL,
  "invoiceNumber" TEXT,
  "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupplierPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierInvoiceId" TEXT,
  "number" TEXT NOT NULL,
  "method" "SupplierPaymentMethod" NOT NULL DEFAULT 'CASH',
  "amount" DECIMAL(12,2) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierInvoice_tenantId_number_key" ON "SupplierInvoice"("tenantId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayment_tenantId_number_key" ON "SupplierPayment"("tenantId", "number");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_tenantId_idx" ON "SupplierInvoice"("tenantId");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_supplierId_idx" ON "SupplierInvoice"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_purchaseOrderId_idx" ON "SupplierInvoice"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_status_idx" ON "SupplierInvoice"("status");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_invoiceDate_idx" ON "SupplierInvoice"("invoiceDate");
CREATE INDEX IF NOT EXISTS "SupplierPayment_tenantId_idx" ON "SupplierPayment"("tenantId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_supplierInvoiceId_idx" ON "SupplierPayment"("supplierInvoiceId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_method_idx" ON "SupplierPayment"("method");
CREATE INDEX IF NOT EXISTS "SupplierPayment_paidAt_idx" ON "SupplierPayment"("paidAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_storeId_idx" ON "PurchaseOrder"("storeId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_warehouseId_idx" ON "PurchaseOrder"("warehouseId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierInvoice_tenantId_fkey') THEN
    ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierInvoice_supplierId_fkey') THEN
    ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierInvoice_purchaseOrderId_fkey') THEN
    ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierPayment_tenantId_fkey') THEN
    ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierPayment_supplierId_fkey') THEN
    ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierPayment_supplierInvoiceId_fkey') THEN
    ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
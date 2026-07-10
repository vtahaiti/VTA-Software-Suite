CREATE TABLE IF NOT EXISTS "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "size" TEXT,
    "model" TEXT,
    "capacity" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "subCategory" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "qrCode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "promotionalPrice" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maximumStock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "manufacturingDate" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "warrantyMonths" INTEGER;

CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX IF NOT EXISTS "ProductVariant_sku_idx" ON "ProductVariant"("sku");
CREATE INDEX IF NOT EXISTS "ProductVariant_barcode_idx" ON "ProductVariant"("barcode");
CREATE INDEX IF NOT EXISTS "Product_tenantId_supplierId_idx" ON "Product"("tenantId", "supplierId");
CREATE INDEX IF NOT EXISTS "Product_tenantId_expirationDate_idx" ON "Product"("tenantId", "expirationDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_productId_fkey') THEN
    ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_supplierId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
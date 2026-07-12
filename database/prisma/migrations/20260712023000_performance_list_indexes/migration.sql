-- Non-destructive indexes for tenant-scoped list pages.
CREATE INDEX IF NOT EXISTS "Product_tenantId_isActive_name_idx" ON "Product"("tenantId", "isActive", "name");
CREATE INDEX IF NOT EXISTS "Product_tenantId_isActive_createdAt_idx" ON "Product"("tenantId", "isActive", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_tenantId_status_createdAt_idx" ON "Sale"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_tenantId_customerId_createdAt_idx" ON "Sale"("tenantId", "customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_status_createdAt_idx" ON "Customer"("tenantId", "status", "createdAt");

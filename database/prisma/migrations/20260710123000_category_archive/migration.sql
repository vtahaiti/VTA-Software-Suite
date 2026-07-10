ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Category_tenantId_archivedAt_idx" ON "Category"("tenantId", "archivedAt");

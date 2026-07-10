ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
CREATE INDEX IF NOT EXISTS "Sale_createdById_idx" ON "Sale"("createdById");

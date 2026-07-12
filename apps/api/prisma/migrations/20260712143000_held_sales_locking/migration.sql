-- Non-destructive locking fields for POS held sales.
DO $$ BEGIN
  CREATE TYPE "HeldSaleStatus" AS ENUM ('AVAILABLE', 'CLAIMED', 'FINALIZING', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "status" "HeldSaleStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "claimedByUserId" TEXT;
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "claimedBySessionId" TEXT;
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "claimExpiresAt" TIMESTAMP(3);
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "finalizedSaleId" TEXT;
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "finalizeIdempotencyKey" TEXT;
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "HeldSale" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "HeldSale_tenantId_status_claimExpiresAt_idx" ON "HeldSale"("tenantId", "status", "claimExpiresAt");
CREATE INDEX IF NOT EXISTS "HeldSale_tenantId_finalizeIdempotencyKey_idx" ON "HeldSale"("tenantId", "finalizeIdempotencyKey");

ALTER TABLE "Notification"
 ADD COLUMN IF NOT EXISTS "role" TEXT,
 ADD COLUMN IF NOT EXISTS "link" TEXT,
 ADD COLUMN IF NOT EXISTS "dedupKey" TEXT,
 ADD COLUMN IF NOT EXISTS "metadata" JSONB,
 ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Notification_tenantId_dedupKey_idx" ON "Notification"("tenantId", "dedupKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_tenantId_userId_dedupKey_key" ON "Notification"("tenantId", "userId", "dedupKey");

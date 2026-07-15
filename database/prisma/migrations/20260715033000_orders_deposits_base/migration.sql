ALTER TYPE "SalesDocumentStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "SalesDocumentStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "SalesDocumentStatus" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "SalesDocumentStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "SalesDocumentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "proformaId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Payment_proformaId_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_proformaId_fkey"
      FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_proformaId_idx" ON "Payment"("proformaId");

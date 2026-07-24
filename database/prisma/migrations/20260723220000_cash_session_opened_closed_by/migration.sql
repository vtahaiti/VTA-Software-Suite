-- AlterTable
ALTER TABLE "CashSession" ADD COLUMN "openedById" TEXT;
ALTER TABLE "CashSession" ADD COLUMN "closedById" TEXT;

-- CreateIndex
CREATE INDEX "CashSession_openedById_idx" ON "CashSession"("openedById");

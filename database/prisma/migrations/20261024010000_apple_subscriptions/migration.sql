CREATE TABLE "AppleSubscriptionPurchase" (
  "originalTransactionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppleSubscriptionPurchase_pkey" PRIMARY KEY ("originalTransactionId")
);
CREATE INDEX "AppleSubscriptionPurchase_tenantId_idx" ON "AppleSubscriptionPurchase"("tenantId");

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TenantStatus" ADD VALUE 'PAUSED';
ALTER TYPE "TenantStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'HTG',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0;

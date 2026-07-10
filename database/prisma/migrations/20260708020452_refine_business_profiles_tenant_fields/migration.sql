-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "businessCategory" TEXT,
ADD COLUMN     "businessProfileType" TEXT,
ADD COLUMN     "enabledBusinessModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "primaryActivity" TEXT,
ADD COLUMN     "secondaryActivities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "businessCategory" TEXT,
ADD COLUMN     "businessProfileType" TEXT,
ADD COLUMN     "enabledBusinessModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "primaryActivity" TEXT,
ADD COLUMN     "secondaryActivities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "businessCategory" TEXT,
ADD COLUMN     "businessProfileType" TEXT,
ADD COLUMN     "enabledBusinessModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "primaryActivity" TEXT,
ADD COLUMN     "secondaryActivities" TEXT[] DEFAULT ARRAY[]::TEXT[];

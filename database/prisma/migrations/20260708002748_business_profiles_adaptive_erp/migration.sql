-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "icon" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessModule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "route" TEXT,
    "icon" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "menuItems" JSONB,
    "widgets" JSONB,
    "offlineReady" BOOLEAN NOT NULL DEFAULT false,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessModuleAssignment" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "businessModuleId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessModuleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBusinessProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBusinessModule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessModuleId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'profile',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBusinessModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_slug_key" ON "BusinessProfile"("slug");

-- CreateIndex
CREATE INDEX "BusinessProfile_category_idx" ON "BusinessProfile"("category");

-- CreateIndex
CREATE INDEX "BusinessProfile_isActive_idx" ON "BusinessProfile"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessModule_key_key" ON "BusinessModule"("key");

-- CreateIndex
CREATE INDEX "BusinessModule_category_idx" ON "BusinessModule"("category");

-- CreateIndex
CREATE INDEX "BusinessModule_isActive_idx" ON "BusinessModule"("isActive");

-- CreateIndex
CREATE INDEX "BusinessModuleAssignment_businessProfileId_idx" ON "BusinessModuleAssignment"("businessProfileId");

-- CreateIndex
CREATE INDEX "BusinessModuleAssignment_businessModuleId_idx" ON "BusinessModuleAssignment"("businessModuleId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessModuleAssignment_businessProfileId_businessModuleId_key" ON "BusinessModuleAssignment"("businessProfileId", "businessModuleId");

-- CreateIndex
CREATE INDEX "TenantBusinessProfile_tenantId_idx" ON "TenantBusinessProfile"("tenantId");

-- CreateIndex
CREATE INDEX "TenantBusinessProfile_businessProfileId_idx" ON "TenantBusinessProfile"("businessProfileId");

-- CreateIndex
CREATE INDEX "TenantBusinessProfile_isActive_idx" ON "TenantBusinessProfile"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBusinessProfile_tenantId_businessProfileId_key" ON "TenantBusinessProfile"("tenantId", "businessProfileId");

-- CreateIndex
CREATE INDEX "TenantBusinessModule_tenantId_idx" ON "TenantBusinessModule"("tenantId");

-- CreateIndex
CREATE INDEX "TenantBusinessModule_businessModuleId_idx" ON "TenantBusinessModule"("businessModuleId");

-- CreateIndex
CREATE INDEX "TenantBusinessModule_isActive_idx" ON "TenantBusinessModule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBusinessModule_tenantId_businessModuleId_key" ON "TenantBusinessModule"("tenantId", "businessModuleId");

-- AddForeignKey
ALTER TABLE "BusinessModuleAssignment" ADD CONSTRAINT "BusinessModuleAssignment_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessModuleAssignment" ADD CONSTRAINT "BusinessModuleAssignment_businessModuleId_fkey" FOREIGN KEY ("businessModuleId") REFERENCES "BusinessModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBusinessProfile" ADD CONSTRAINT "TenantBusinessProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBusinessProfile" ADD CONSTRAINT "TenantBusinessProfile_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBusinessModule" ADD CONSTRAINT "TenantBusinessModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBusinessModule" ADD CONSTRAINT "TenantBusinessModule_businessModuleId_fkey" FOREIGN KEY ("businessModuleId") REFERENCES "BusinessModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

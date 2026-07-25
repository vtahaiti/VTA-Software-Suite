-- Reservation d'actif generique (vehicule de location, chambre d'hotel) : additive, ne touche aucune
-- table existante. Un Product represente l'actif (SKU = plaque / numero de chambre).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetReservationType') THEN
    CREATE TYPE "AssetReservationType" AS ENUM ('VEHICLE', 'ROOM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetReservationStatus') THEN
    CREATE TYPE "AssetReservationStatus" AS ENUM ('ACTIVE', 'RETURNED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AssetReservation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "assetType" "AssetReservationType" NOT NULL,
  "status" "AssetReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedEndDate" TIMESTAMP(3) NOT NULL,
  "actualEndDate" TIMESTAMP(3),
  "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetReservation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssetReservation_tenantId_fkey') THEN
    ALTER TABLE "AssetReservation"
      ADD CONSTRAINT "AssetReservation_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssetReservation_productId_fkey') THEN
    ALTER TABLE "AssetReservation"
      ADD CONSTRAINT "AssetReservation_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssetReservation_customerId_fkey') THEN
    ALTER TABLE "AssetReservation"
      ADD CONSTRAINT "AssetReservation_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AssetReservation_tenantId_idx" ON "AssetReservation"("tenantId");
CREATE INDEX IF NOT EXISTS "AssetReservation_productId_idx" ON "AssetReservation"("productId");
CREATE INDEX IF NOT EXISTS "AssetReservation_customerId_idx" ON "AssetReservation"("customerId");
CREATE INDEX IF NOT EXISTS "AssetReservation_tenantId_assetType_status_idx" ON "AssetReservation"("tenantId", "assetType", "status");

-- Garde d'atomicite au niveau base : un meme actif ne peut jamais avoir 2 reservations ACTIVE en meme
-- temps, meme sous 2 requetes concurrentes (le 2e INSERT echoue avec une violation de contrainte unique
-- au lieu de creer un double-booking silencieux).
CREATE UNIQUE INDEX IF NOT EXISTS "AssetReservation_active_asset_key"
  ON "AssetReservation" ("tenantId", "productId")
  WHERE "status" = 'ACTIVE';

-- Fabrication fenetres/portes V1 : titre de document + date de livraison/installation prevue.
-- Additif uniquement, colonnes nullable, aucun backfill, aucune donnee existante modifiee.

ALTER TABLE "Quote"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "expectedDate" TIMESTAMP(3);

ALTER TABLE "Proforma"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "expectedDate" TIMESTAMP(3);

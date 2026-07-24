-- Champs facultatifs pour le profil entreprise : numero de patente (licence commerciale) et numero
-- de compte bancaire, affichables sur les devis. Purement additif, nullable, aucune donnee existante
-- affectee.
ALTER TABLE "CompanyProfile" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "businessLicenseNumber" TEXT;

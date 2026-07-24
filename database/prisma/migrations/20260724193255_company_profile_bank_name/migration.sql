-- Nom de la banque (facultatif), a cote du numero de compte bancaire deja ajoute. Additif, nullable,
-- aucune donnee existante affectee.
ALTER TABLE "CompanyProfile" ADD COLUMN     "bankName" TEXT;

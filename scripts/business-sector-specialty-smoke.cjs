const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const catalog = fs.readFileSync(path.join(root, "apps/api/src/business-profiles/business-catalog.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "apps/api/src/business-profiles/business-profiles.service.ts"), "utf8");
const onboarding = fs.readFileSync(path.join(root, "apps/web/app/onboarding/company/page.tsx"), "utf8");
const webLib = fs.readFileSync(path.join(root, "apps/web/lib/business-profiles.ts"), "utf8");

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

for (const sector of [
  "Commerce / Market",
  "Restaurant / Bar",
  "Hotel / Hebergement",
  "Services / Multi-activite",
  "Fabrication / Atelier",
  "Construction / Quincaillerie",
  "Sante / Clinique / Pharmacie",
  "Telephone / Electronique",
  "Education / Ecole",
  "Beaute / Salon",
  "Transport / Location",
  "Autre activite"
]) {
  expect(catalog.includes(`name: "${sector}"`), `secteur manquant: ${sector}`);
}

for (const specialty of [
  "Epicerie / Market",
  "Pharmacie",
  "Clinique",
  "Reparation telephones",
  "Vente telephones",
  "Hotel avec restaurant",
  "Quincaillerie",
  "Materiaux de construction",
  "Fabrication fenêtres/portes",
  "Multi-activite"
]) {
  expect(catalog.includes(`name: "${specialty}"`), `specialite manquante: ${specialty}`);
}

for (const slug of ["commerce", "restaurant", "hotel", "hotel-restaurant", "services", "it-services", "printing", "manufacturing", "windows-aluminium", "construction-materials", "hardware", "pharmacy", "clinic", "school", "fashion", "multi-activities"]) {
  expect(catalog.includes(`profileType: "${slug}"`) || catalog.includes(`slug: "${slug}"`), `profil cible inconnu: ${slug}`);
}

expect(catalog.includes("export const businessSectors"), "source de verite BusinessSector absente");
expect(catalog.includes("businessActivityTemplates: BusinessActivityTemplate[] = businessSectors.flatMap"), "compatibilite templates derivee des secteurs");
expect(catalog.includes("businessCategories: BusinessCategoryDefinition[] = businessSectors.map"), "compatibilite categories derivee des secteurs");
expect(service.includes("sectors: businessSectors"), "API catalog expose les secteurs");
expect(webLib.includes("export type BusinessSector"), "Web connait BusinessSector");
expect(onboarding.includes('label="Secteur"'), "Onboarding affiche le select Secteur");
expect(onboarding.includes('label="Specialite"'), "Onboarding affiche le select Specialite");
expect(onboarding.includes("businessCategory: form.businessSector"), "Onboarding sauvegarde le secteur dans businessCategory");
expect(onboarding.includes("primaryActivity: form.businessSpecialty"), "Onboarding sauvegarde la specialite dans primaryActivity");
expect(onboarding.includes("businessProfileSlug: form.businessProfileSlug"), "Onboarding transmet le profil mappe");

if (failures.length) {
  console.error("Business sector/specialty smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Business sector/specialty smoke OK");

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
  "Services / Multi-activité",
  "Fabrication / Atelier",
  "Construction / Quincaillerie",
  "Sante / Clinique / Pharmacie",
  "Téléphone / Electronique",
  "Beaute / Salon",
  "Transport / Location",
  "Autre activite"
]) {
  expect(catalog.includes(`name: "${sector}"`), `secteur manquant: ${sector}`);
}
expect(!catalog.includes('key: "education"'), "Le secteur Education / Ecole ne doit plus etre propose dans VTA Commerce.");
expect(service.includes('profile.slug !== "school"'), "Le profil scolaire doit rester interne et etre retire du catalogue public.");
expect(service.includes('module.key !== "school"'), "Le module scolaire doit rester interne et etre retire du catalogue public.");

for (const specialty of [
  "Epicerie / Market",
  "Pharmacie",
  "Clinique",
  "Reparation telephones",
  "Vente & Reparation telephones",
  "Vente telephones",
  "Hotel avec restaurant",
  "Quincaillerie",
  "Matériaux de construction",
  "Fabrication fenêtres/portes",
  "Multi-activité"
]) {
  expect(catalog.includes(`name: "${specialty}"`), `spécialité manquante: ${specialty}`);
}

for (const slug of ["commerce", "restaurant", "hotel", "hotel-restaurant", "services", "it-services", "phone-sales-repair", "printing", "manufacturing", "windows-aluminium", "construction-materials", "hardware", "pharmacy", "clinic", "school", "fashion", "multi-activities"]) {
  expect(catalog.includes(`profileType: "${slug}"`) || catalog.includes(`slug: "${slug}"`), `profil cible inconnu: ${slug}`);
}

const profileBlock = (slug) => catalog.match(new RegExp(`\\{\\s*slug:\\s*"${slug}"[\\s\\S]*?\\}`))?.[0] ?? "";
const profileHasModule = (slug, moduleKey) => profileBlock(slug).includes(`"${moduleKey}"`);

for (const slug of ["commerce", "restaurant", "hotel", "hotel-restaurant", "pharmacy", "clinic", "fashion"]) {
  expect(!profileHasModule(slug, "sales"), `Devis & Commandes ne doit pas etre actif par défaut pour ${slug}`);
}

for (const slug of ["services", "it-services", "printing", "manufacturing", "windows-aluminium", "construction-materials", "hardware", "multi-activities"]) {
  expect(profileHasModule(slug, "sales"), `Devis & Commandes doit etre actif par défaut pour ${slug}`);
}
expect(profileHasModule("phone-sales-repair", "sales"), "Vente & Reparation telephones doit activer Devis & Commandes.");
expect(profileHasModule("phone-sales-repair", "inventory"), "Vente & Reparation telephones doit activer Inventaire.");
expect(!profileHasModule("clinic", "pharmacy"), "Clinique ne doit pas embarquer le module pharmacie.");

expect(service.includes("businessModuleAssignment.deleteMany"), "Le catalogue doit retirer les associations de modules obsoletes.");
expect(catalog.includes("export function resolveBusinessModuleKeys"), "La matrice centrale des modules visibles doit etre exportee.");
expect(service.includes("resolveBusinessModuleKeys"), "La configuration tenant doit utiliser la matrice centrale des modules.");
expect(service.includes("matrixModuleKeys.has(assignment.businessModule.key) || assignment.source === \"manual\""), "Les modules hérités doivent etre filtres, sauf override manuel explicite.");
expect(service.includes("enabledBusinessModules: activeModules.map((module) => module.key)"), "L'API ne doit pas renvoyer une ancienne liste enabledBusinessModules non filtrée.");
expect(catalog.includes("export const businessSectors"), "source de vérité BusinessSector absente");
expect(catalog.includes("businessActivityTemplates: BusinessActivityTemplate[] = businessSectors.flatMap"), "compatibilite templates derivee des secteurs");
expect(catalog.includes("businessCategories: BusinessCategoryDefinition[] = businessSectors.map"), "compatibilite categories derivee des secteurs");
expect(service.includes("sectors: businessSectors"), "API catalog expose les secteurs");
expect(webLib.includes("export type BusinessSector"), "Web connait BusinessSector");
expect(onboarding.includes('label="Secteur"'), "Onboarding affiche le select Secteur");
expect(onboarding.includes('label="Spécialité"'), "Onboarding affiche le select Spécialité");
expect(onboarding.includes("businessCategory: form.businessSector"), "Onboarding sauvegarde le secteur dans businessCategory");
expect(onboarding.includes("primaryActivity: form.businessSpecialty"), "Onboarding sauvegarde la spécialité dans primaryActivity");
expect(onboarding.includes("businessProfileSlug: form.businessProfileSlug"), "Onboarding transmet le profil mappe");

if (failures.length) {
  console.error("Business sector/specialty smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Business sector/specialty smoke OK");
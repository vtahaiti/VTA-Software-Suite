const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const serviceSource = fs.readFileSync(path.join(root, "apps/api/src/business-profiles/business-profiles.service.ts"), "utf8");
const catalogSource = fs.readFileSync(path.join(root, "apps/api/src/business-profiles/business-catalog.ts"), "utf8");
const navigationSource = fs.readFileSync(path.join(root, "apps/web/lib/navigation.tsx"), "utf8");
const onboardingSource = fs.readFileSync(path.join(root, "apps/web/app/onboarding/company/page.tsx"), "utf8");
const productFormSource = fs.readFileSync(path.join(root, "apps/web/app/dashboard/products/product-form.tsx"), "utf8");
const posDtoSource = fs.readFileSync(path.join(root, "apps/api/src/pos/dto/pos-cart.dto.ts"), "utf8");
const posServiceSource = fs.readFileSync(path.join(root, "apps/api/src/pos/pos.service.ts"), "utf8");
const importSource = fs.readFileSync(path.join(root, "apps/api/src/import-export/import.service.ts"), "utf8");
const exportSource = fs.readFileSync(path.join(root, "apps/api/src/import-export/export.service.ts"), "utf8");
const failures = [];

const commonRoutes = [
  ["/dashboard", "dashboard"],
  ["/dashboard/pos", "pos"],
  ["/dashboard/sales/in-progress", "pos"],
  ["/dashboard/sales/completed", "pos"],
  ["/dashboard/sales", "sales"],
  ["/dashboard/products", "products"],
  ["/dashboard/products/categories", "products"],
  ["/dashboard/inventory", "inventory"],
  ["/dashboard/customers", "customers"],
  ["/dashboard/suppliers", "suppliers"],
  ["/dashboard/purchases", "suppliers"],
  ["/dashboard/reports", "reports"],
  ["/dashboard/settings/company", "settings"],
  ["/dashboard/settings/subscription", "settings"],
  ["/dashboard/settings/emails", "settings"]
];

if (!serviceSource.includes("withCommonCapabilities")) {
  failures.push("BusinessProfilesService doit fusionner les raccourcis specialises avec le socle commun.");
}
if (!serviceSource.includes("resolveBusinessModuleKeys") || !serviceSource.includes("assignment.source === \"manual\"")) {
  failures.push("Navigation API: les anciens modules actifs doivent etre filtres par matrice, avec override manuel explicite seulement.");
}
if (!serviceSource.includes("enabledBusinessModules: activeModules.map((module) => module.key)")) {
  failures.push("Navigation API: enabledBusinessModules doit refleter les modules effectifs filtres.");
}

for (const [href, moduleKey] of commonRoutes) {
  if (!serviceSource.includes(`href: "${href}", module: "${moduleKey}"`)) {
    failures.push(`Socle commun absent: ${href} via module ${moduleKey}`);
  }
}

const manufacturingProfile = catalogSource.match(/\{\s*slug:\s*"manufacturing"[\s\S]*?\}/)?.[0] ?? "";
for (const moduleKey of ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"]) {
  if (!manufacturingProfile.includes(`"${moduleKey}"`)) {
    failures.push(`Profil Fabrication: module requis absent: ${moduleKey}`);
  }
}

const windowsProfile = catalogSource.match(/\{\s*slug:\s*"windows-aluminium"[\s\S]*?\}/)?.[0] ?? "";
for (const moduleKey of ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"]) {
  if (!windowsProfile.includes(`"${moduleKey}"`)) {
    failures.push(`Profil Fabrication fenetres/portes: module requis absent: ${moduleKey}`);
  }
}

const multiActivitiesProfile = catalogSource.match(/\{\s*slug:\s*"multi-activities"[\s\S]*?\}/)?.[0] ?? "";
for (const moduleKey of ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "printing", "services", "it-services", "measurements"]) {
  if (!multiActivitiesProfile.includes(`"${moduleKey}"`)) {
    failures.push(`Profil Multi-activité / Commerce & Services: module requis absent: ${moduleKey}`);
  }
}

for (const profileSlug of ["hardware", "construction-materials"]) {
  const profile = catalogSource.match(new RegExp(`\\{\\s*slug:\\s*"${profileSlug}"[\\s\\S]*?\\}`))?.[0] ?? "";
  for (const moduleKey of ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"]) {
    if (!profile.includes(`"${moduleKey}"`)) {
      failures.push(`Profil ${profileSlug}: module requis absent: ${moduleKey}`);
    }
  }
}

for (const label of ["Matériaux de construction", "Quincaillerie", "Multi-activité / Commerce & Services"]) {
  if (!onboardingSource.includes(label)) {
    failures.push(`Onboarding: activité absente: ${label}`);
  }
}

for (const unit of ["pièce", "sac", "tonne", "kg", "mètre", "pied", "feuille", "gallon", "litre", "boîte", "paquet", "verge"]) {
  if (!productFormSource.includes(unit)) {
    failures.push(`Formulaire produit: unité matériaux absente: ${unit}`);
  }
}

if (!onboardingSource.includes("Fabrication fenetres/portes")) {
  failures.push("Onboarding: activite absente: Fabrication fenetres/portes");
}

for (const expected of ["Fabrication fenêtres/portes", "Fenêtres", "Moustiquaires", "PVC", "Métal"]) {
  if (!catalogSource.includes(expected)) {
    failures.push(`Catalogue API fabrication fenetres/portes incomplet: ${expected}`);
  }
}

const salesDocumentPageSource = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/sales-document-page.tsx"), "utf8");
for (const expected of ["showFabricationFields", "Notes de mesure", "Livraison / installation", "En cours / En fabrication", "Prete pour livraison/installation"]) {
  if (!salesDocumentPageSource.includes(expected)) {
    failures.push(`UI Devis & Commandes fabrication incomplete: ${expected}`);
  }
}

for (const suggestion of ["Accessoires / Cadeaux", "Informatique", "Impression", "Studio photo", "Bois / Fabrication", "Services"]) {
  if (!catalogSource.includes(suggestion) && !onboardingSource.includes(suggestion)) {
    failures.push(`Suggestions Multi-activité absentes: ${suggestion}`);
  }
}

if (catalogSource.includes("VTA Enterprise") || onboardingSource.includes("VTA Enterprise")) {
  failures.push("Le nom VTA Enterprise ne doit pas etre utilise comme profil public.");
}

for (const expected of ["assertQuantityAllowed", "Quantité decimale autorisee seulement", "Number.isInteger(item.quantity)"]) {
  if (!posServiceSource.includes(expected)) {
    failures.push(`POS API: garde-fou quantité décimale absent: ${expected}`);
  }
}

if (!posDtoSource.includes("@IsNumber()")) {
  failures.push("POS DTO: la quantité doit accepter un nombre pour les unités mesurables.");
}

for (const expected of ["supplierReference", "ensureUnit", "unit:"]) {
  if (!importSource.includes(expected)) {
    failures.push(`Import produits: support matériaux absent: ${expected}`);
  }
}

for (const expected of ["Référence fournisseur", "Dimensions", "Type / Matériau", "variants"]) {
  if (!exportSource.includes(expected)) {
    failures.push(`Export produits: colonne matériaux absente: ${expected}`);
  }
}

for (const route of ["/dashboard/sales/in-progress", "/dashboard/sales/completed"]) {
  if (!navigationSource.includes(`href === "${route}" && sourceHrefs.has("/dashboard/pos")`)) {
    failures.push(`Navigation Web: ${route} doit rester derive de la capacite POS.`);
  }
}

if (failures.length) {
  console.error("Business profile navigation smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Business profile navigation smoke OK");

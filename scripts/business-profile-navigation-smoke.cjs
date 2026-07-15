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

for (const profileSlug of ["hardware", "construction-materials"]) {
  const profile = catalogSource.match(new RegExp(`\\{\\s*slug:\\s*"${profileSlug}"[\\s\\S]*?\\}`))?.[0] ?? "";
  for (const moduleKey of ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"]) {
    if (!profile.includes(`"${moduleKey}"`)) {
      failures.push(`Profil ${profileSlug}: module requis absent: ${moduleKey}`);
    }
  }
}

for (const label of ["Materiaux de construction", "Quincaillerie"]) {
  if (!onboardingSource.includes(label)) {
    failures.push(`Onboarding: activité absente: ${label}`);
  }
}

for (const unit of ["pièce", "sac", "tonne", "kg", "mètre", "pied", "feuille", "gallon", "litre", "boîte", "paquet", "verge"]) {
  if (!productFormSource.includes(unit)) {
    failures.push(`Formulaire produit: unité matériaux absente: ${unit}`);
  }
}

for (const expected of ["assertQuantityAllowed", "Quantite decimale autorisee seulement", "Number.isInteger(item.quantity)"]) {
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

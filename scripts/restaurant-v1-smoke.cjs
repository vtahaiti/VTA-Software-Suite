const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const catalogSource = read("apps/api/src/business-profiles/business-catalog.ts");
const serviceSource = read("apps/api/src/business-profiles/business-profiles.service.ts");
const productFormSource = read("apps/web/app/dashboard/products/product-form.tsx");
const posPageSource = read("apps/web/app/dashboard/pos/page.tsx");
const salesStatusSource = read("apps/web/app/dashboard/sales/sales-status-page.tsx");
const inventoryPageSource = read("apps/web/app/dashboard/inventory/page.tsx");
const dashboardSource = read("apps/web/app/dashboard/adaptive-dashboard.tsx");
const onboardingSource = read("apps/api/src/onboarding/onboarding.service.ts");

const failures = [];

const restaurantProfile = catalogSource.match(/\{\s*slug:\s*"restaurant"[\s\S]*?\}/)?.[0] ?? "";
for (const moduleKey of ["dashboard", "pos", "products", "inventory", "customers", "reports", "settings", "restaurant"]) {
  if (!restaurantProfile.includes(`"${moduleKey}"`)) failures.push(`Profil Restaurant V1: module absent ${moduleKey}`);
}
if (restaurantProfile.includes('"suppliers"')) failures.push("Profil Restaurant V1: Achats/Fournisseurs ne doit pas être actif par défaut.");
if (restaurantProfile.includes('"sales"')) failures.push("Profil Restaurant V1: Devis & Commandes ne doit pas être actif par défaut.");

const restaurantModule = catalogSource.match(/\{\s*key:\s*"restaurant"[\s\S]*?\},\r?\n\s*\{\s*key:\s*"hotel"/)?.[0] ?? "";
for (const expected of ["POS / Nouvelle commande", "Produits / menus", "Commandes ouvertes", "Historique ventes", "Stock ingrédients / Inventaire", "Notifications"]) {
  if (!restaurantModule.includes(expected)) failures.push(`Module Restaurant V1: entrée absente ${expected}`);
}
if (restaurantModule.includes("Dépenses / achats") || restaurantModule.includes("/dashboard/purchases")) {
  failures.push("Module Restaurant V1: Achats/Fournisseurs ne doit pas être affiché par défaut.");
}
if (restaurantModule.includes("Tables") || restaurantModule.includes("Envoyer en cuisine")) {
  failures.push("Module Restaurant V1: ne doit pas promettre tables/cuisine.");
}

const simpleRestaurantMenu = serviceSource.match(/if \(normalizedProfile === "restaurant"\) \{[\s\S]*?return \[[\s\S]*?\];\n\s*\}/)?.[0] ?? "";
for (const expected of ["POS / Nouvelle commande", "Commandes ouvertes", "Historique ventes", "Produits / menus", "Catégories", "Stock ingrédients / Inventaire", "Clients", "Rapports", "Notifications", "Paramètres"]) {
  if (!simpleRestaurantMenu.includes(expected)) failures.push(`Menu simple Restaurant V1: entrée absente ${expected}`);
}
if (simpleRestaurantMenu.includes("Devis & Commandes")) failures.push("Menu simple Restaurant V1: Devis & Commandes ne doit pas apparaître par défaut.");
if (simpleRestaurantMenu.includes("Dépenses / achats") || simpleRestaurantMenu.includes("/dashboard/purchases")) failures.push("Menu simple Restaurant V1: Achats/Fournisseurs ne doit pas apparaître par défaut.");

const expertRestaurantMenu = serviceSource.match(/restaurant:\s*\[[\s\S]*?\],\r?\n\s*hotel:/)?.[0] ?? "";
for (const expected of ["POS / Nouvelle commande", "Commandes ouvertes", "Historique ventes", "Produits / Menus", "Stock ingrédients / Inventaire", "Notifications"]) {
  if (!expertRestaurantMenu.includes(expected)) failures.push(`Menu expert Restaurant V1: entrée absente ${expected}`);
}
if (expertRestaurantMenu.includes("Dépenses / achats") || expertRestaurantMenu.includes("/dashboard/purchases")) failures.push("Menu expert Restaurant V1: Achats/Fournisseurs ne doit pas apparaître par défaut.");
if (expertRestaurantMenu.includes("Tables") || expertRestaurantMenu.includes("Envoyer en cuisine")) {
  failures.push("Menu expert Restaurant V1: ne doit pas promettre tables/cuisine.");
}

if (productFormSource.includes("Suggestions Restaurant V1")) {
  failures.push("Formulaire produit: ne doit pas ramener une section Restaurant V1 visible.");
}

for (const expected of ["Emplacements Restaurant", "Dépôt principal", "Réfrigérateur", "Cuisine", "Bar"]) {
  if (!inventoryPageSource.includes(expected)) failures.push(`Inventaire Restaurant V1: emplacement/texte absent ${expected}`);
}
if (!inventoryPageSource.includes("isRestaurantInventoryProfile")) {
  failures.push("Inventaire Restaurant V1: les emplacements doivent être contextualisés au profil.");
}

if (posPageSource.includes("Envoyer en cuisine") || posPageSource.includes("table, cuisine")) {
  failures.push("POS Restaurant V1: ne doit pas promettre cuisine/tables.");
}
for (const expected of ["Commande restaurant", "Garder en commande ouverte", "Rechercher plat, boisson, menu"]) {
  if (!posPageSource.includes(expected)) failures.push(`POS Restaurant V1: texte absent ${expected}`);
}
if (!posPageSource.includes("existsOnServer") || !posPageSource.includes("clearPosDraft()")) {
  failures.push("POS Restaurant V1: un brouillon local doit être ignoré si le serveur ne confirme pas la vente en attente.");
}
if (!salesStatusSource.includes("uniqueDrafts") || salesStatusSource.includes("function loadDrafts")) {
  failures.push("Ventes en attente: liste serveur dédupliquée obligatoire, sans source locale principale.");
}

for (const expected of ["Produits / menu", "Ventes en attente", "Ventes du jour"]) {
  if (!dashboardSource.includes(expected)) failures.push(`Dashboard Restaurant V1: carte absente ${expected}`);
}

if (!onboardingSource.includes("businessProfileType") || !onboardingSource.includes("primaryActivity")) {
  failures.push("Onboarding doit conserver le profil Restaurant sélectionné.");
}

if (failures.length) {
  console.error("Restaurant V1 smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Restaurant V1 smoke OK");

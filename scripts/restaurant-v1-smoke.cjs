const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const catalogSource = fs.readFileSync(path.join(root, "apps/api/src/business-profiles/business-catalog.ts"), "utf8");
const serviceSource = fs.readFileSync(path.join(root, "apps/api/src/business-profiles/business-profiles.service.ts"), "utf8");
const productFormSource = fs.readFileSync(path.join(root, "apps/web/app/dashboard/products/product-form.tsx"), "utf8");
const posPageSource = fs.readFileSync(path.join(root, "apps/web/app/dashboard/pos/page.tsx"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "apps/web/app/dashboard/adaptive-dashboard.tsx"), "utf8");

const failures = [];

const restaurantProfile = catalogSource.match(/\{\s*slug:\s*"restaurant"[\s\S]*?\}/)?.[0] ?? "";
for (const moduleKey of ["dashboard", "pos", "products", "customers", "sales", "reports", "settings", "restaurant"]) {
  if (!restaurantProfile.includes(`"${moduleKey}"`)) failures.push(`Profil Restaurant V1: module absent ${moduleKey}`);
}

const restaurantModule = catalogSource.match(/\{\s*key:\s*"restaurant"[\s\S]*?\},\r?\n\s*\{\s*key:\s*"hotel"/)?.[0] ?? "";
for (const expected of ["POS / Nouvelle vente", "Produits / menu", "Ventes en attente", "Historique"]) {
  if (!restaurantModule.includes(expected)) failures.push(`Module Restaurant V1: entree absente ${expected}`);
}
if (restaurantModule.includes("Tables") || restaurantModule.includes("Cuisine")) {
  failures.push("Module Restaurant V1: ne doit pas promettre tables/cuisine.");
}

const simpleRestaurantMenu = serviceSource.match(/if \(normalizedProfile === "restaurant"\) \{[\s\S]*?return \[[\s\S]*?\];\n\s*\}/)?.[0] ?? "";
for (const expected of ["POS / Nouvelle vente", "Ventes en attente", "Historique des ventes", "Produits / menu", "Categories", "Clients", "Rapports", "Parametres"]) {
  if (!simpleRestaurantMenu.includes(expected)) failures.push(`Menu simple Restaurant V1: entree absente ${expected}`);
}

const expertRestaurantMenu = serviceSource.match(/restaurant:\s*\[[\s\S]*?\],\r?\n\s*hotel:/)?.[0] ?? "";
for (const expected of ["Commandes ouvertes", "Historique", "Menu / Articles", "Catégories"]) {
  if (!expertRestaurantMenu.includes(expected)) failures.push(`Menu expert Restaurant V1: entree absente ${expected}`);
}
if (expertRestaurantMenu.includes("Tables") || expertRestaurantMenu.includes("Cuisine")) {
  failures.push("Menu expert Restaurant V1: ne doit pas promettre tables/cuisine.");
}

for (const expected of ["Suggestions Restaurant V1", "Plat", "Boisson", "Dessert", "Extra", "Service / autre"]) {
  if (!productFormSource.includes(expected)) failures.push(`Formulaire Restaurant V1: suggestion absente ${expected}`);
}

if (posPageSource.includes("Envoyer en cuisine") || posPageSource.includes("table, cuisine")) {
  failures.push("POS Restaurant V1: ne doit pas promettre cuisine/tables.");
}
for (const expected of ["Commande restaurant", "Garder en commande ouverte", "Rechercher plat, boisson, menu"]) {
  if (!posPageSource.includes(expected)) failures.push(`POS Restaurant V1: texte absent ${expected}`);
}

for (const expected of ["Produits / menu", "Ventes en attente", "Ventes du jour"]) {
  if (!dashboardSource.includes(expected)) failures.push(`Dashboard Restaurant V1: carte absente ${expected}`);
}

if (failures.length) {
  console.error("Restaurant V1 smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Restaurant V1 smoke OK");

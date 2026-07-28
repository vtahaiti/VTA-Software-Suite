const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const starter = read("apps/api/src/onboarding/restaurant-starter-catalog.ts");
const pos = read("apps/web/app/dashboard/pos/page.tsx");
const products = read("apps/web/app/dashboard/products/page.tsx");
const form = read("apps/web/app/dashboard/products/product-form.tsx");
const stock = read("apps/web/app/dashboard/restaurant/stock/page.tsx");

assert(starter.includes('const sellable = template.category === "Boissons"'), "seules les boissons du stock modèle doivent être vendables");
assert(starter.includes("update: { sellable }"), "les anciens articles modèles doivent recevoir leur classification Restaurant");
assert(starter.includes("update: { sellable: true }"), "les plats modèles doivent rester vendables");
assert(pos.includes("/plat|menu|boisson|extra/i"), "le POS Restaurant doit limiter ses catégories visibles");
assert(pos.includes('isRestaurantContextProfile ? "Nouvelle commande" : "Vente"'), "le titre POS Restaurant doit être Nouvelle commande");
for (const text of ["Ajouter plat / boisson", "Ajouter ingrédient / fourniture", "Plat vendable", "Boisson vendable", "Ingrédient stock", "Fourniture stock", "Réserve stock"]) {
  assert(products.includes(text), `texte/type Produit Restaurant manquant: ${text}`);
}
for (const text of ["Plat / boisson à vendre", "Article de stock interne"]) {
  assert(form.includes(text), `choix du formulaire Restaurant manquant: ${text}`);
}
for (const text of ["Frigo / Congélateur", "Bar / Boissons", "Cuisine / Ingrédients", "Dépôt / Réserves", "Fournitures", "Modifier", "Entrée", "Sortie", "Historique"]) {
  assert(stock.includes(text), `zone/action Stock Restaurant manquante: ${text}`);
}
assert(stock.includes("Array.isArray(data) ? data : data.items ?? []"), "la page Stock doit accepter les deux formes de réponse API");

console.log("Restaurant product separation smoke OK");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function stockStatus(stock) {
  if (!isStockTracked(stock)) return "NON_STOCK";
  if (stock.quantity <= 0) return "OUT_OF_STOCK";
  if (stock.quantity <= stock.minimumStock) return "LOW_STOCK";
  return "IN_STOCK";
}

function lowStockCount(stocks) {
  return stocks.filter((stock) => isStockTracked(stock) && stock.quantity <= stock.minimumStock).length;
}

function isStockTracked(stock) {
  return stock.stockTracked === true || (stock.stockTracked !== false && Number(stock.minimumStock ?? 0) > 0);
}

function unitLabel(product) {
  const value = (product.unit?.symbol ?? product.unit?.name ?? "").trim();
  return Boolean(value) && !/^\d+(?:[.,]\d+)?$/.test(value) ? value : "";
}

const outOfStock = { quantity: 0, minimumStock: 2 };
const lowStock = { quantity: 1, minimumStock: 2 };
const inStock = { quantity: 5, minimumStock: 2 };
const service = { quantity: 0, minimumStock: 0, stockTracked: false };

assert.equal(stockStatus(outOfStock), "OUT_OF_STOCK", "stock 0 + seuil 2 doit être en rupture");
assert.equal(stockStatus(lowStock), "LOW_STOCK", "stock 1 + seuil 2 doit être en stock faible");
assert.equal(stockStatus(inStock), "IN_STOCK", "stock 5 + seuil 2 doit être en stock normal");
assert.equal(stockStatus(service), "NON_STOCK", "service ou produit non stocké ne doit pas être en rupture");
assert.equal(lowStockCount([outOfStock, lowStock, inStock, service]), 2, "le compteur doit inclure rupture et stock faible mais exclure non-stock");

assert.equal(unitLabel({ unit: { symbol: "kg" } }), "kg", "l'unité textuelle doit être affichée");
assert.equal(unitLabel({ unit: { symbol: "18" } }), "", "une ancienne valeur numérique ne doit pas être affichée comme unité");

const root = path.resolve(__dirname, "..");
const inventoryPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/inventory/page.tsx"), "utf8");

for (const label of ["Rupture", "Stock faible", "En stock", "Non suivi"]) {
  assert(inventoryPage.includes(label), `la page Inventaire doit afficher le statut ${label}`);
}
assert(inventoryPage.includes("unitLabel(stock)"), "la page Inventaire doit passer par un libellé d'unité lisible");
assert(inventoryPage.includes("Quantité actuelle"), "la page Inventaire doit afficher la quantité avec un libellé clair");
assert(inventoryPage.includes("Minimum"), "la page Inventaire doit afficher le seuil avec un libellé clair");
for (const marker of [String.fromCharCode(195), String.fromCharCode(194), String.fromCharCode(65533)]) {
  assert(!inventoryPage.includes(marker), `la page Inventaire ne doit pas contenir le marqueur mojibake ${marker}`);
}

console.log("Inventory stock status smoke OK");

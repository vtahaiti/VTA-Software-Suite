const assert = require("node:assert/strict");

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

const outOfStock = { quantity: 0, minimumStock: 2 };
const lowStock = { quantity: 1, minimumStock: 2 };
const inStock = { quantity: 5, minimumStock: 2 };
const service = { quantity: 0, minimumStock: 0, stockTracked: false };

assert.equal(stockStatus(outOfStock), "OUT_OF_STOCK", "stock 0 + seuil 2 doit etre en rupture");
assert.equal(stockStatus(lowStock), "LOW_STOCK", "stock 1 + seuil 2 doit etre en stock faible");
assert.equal(stockStatus(inStock), "IN_STOCK", "stock 5 + seuil 2 doit etre en stock normal");
assert.equal(stockStatus(service), "NON_STOCK", "service ou produit non stocke ne doit pas etre en rupture");
assert.equal(lowStockCount([outOfStock, lowStock, inStock, service]), 2, "le compteur doit inclure rupture et stock faible mais exclure non-stock");

console.log("Inventory stock status smoke OK");

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

function productUnitLabel(product) {
  const value = (product.unit?.symbol ?? product.unit?.name ?? "").trim();
  return isReadableUnitLabel(value) ? value : "";
}

function isReadableUnitLabel(value) {
  return Boolean(value) && !/^\d+(?:[.,]\d+)?$/.test(value);
}

function isProductStockTracked(product) {
  return Number(product.stockCurrent ?? 0) > 0 || Number(product.minimumStock ?? 0) > 0;
}

function productStockStatus(product) {
  if (!isProductStockTracked(product)) return "NON_STOCK";
  const current = Number(product.stockCurrent ?? 0);
  const minimum = Number(product.minimumStock ?? 0);
  if (current <= 0) return "OUT_OF_STOCK";
  if (current <= minimum) return "LOW_STOCK";
  return "IN_STOCK";
}

function productStockDisplay(product) {
  if (!isProductStockTracked(product)) return "Non stocke";
  const unit = productUnitLabel(product);
  const current = `${product.stockCurrent ?? 0}${unit ? ` ${unit}` : ""}`;
  return `${current} - min. ${product.minimumStock ?? 0}`;
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

assert.equal(productStockStatus({ stockCurrent: 0, minimumStock: 18 }), "OUT_OF_STOCK", "produit stock 0 + seuil 18 doit etre en rupture");
assert.equal(productStockDisplay({ stockCurrent: 0, minimumStock: 18, unit: { symbol: "18" } }), "0 - min. 18", "l'unite numerique ne doit pas produire 0 18");
assert.equal(productStockStatus({ stockCurrent: 5, minimumStock: 18 }), "LOW_STOCK", "produit stock 5 + seuil 18 doit etre stock faible");
assert.equal(productStockDisplay({ stockCurrent: 0, minimumStock: 0, unit: null }), "Non stocke", "produit non stocke affiche Non stocke");

const root = path.resolve(__dirname, "..");
const productsPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/products/page.tsx"), "utf8");
const inventoryPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/inventory/page.tsx"), "utf8");
assert(productsPage.includes("productUnitLabel(product)"), "la page Produits doit passer par un libelle d'unite lisible");
assert(productsPage.includes("Seuil min."), "la page Produits doit afficher le seuil avec un libelle");
assert(productsPage.includes("productStockDisplay(product)"), "la page Produits doit centraliser l'affichage stock");
assert(!productsPage.includes("product.stockCurrent ?? 0}{product.unit"), "la page Produits ne doit plus coller stock et unite brute");
assert(inventoryPage.includes('"Non stocke"'), "la page Inventaire doit afficher Non stocke pour service/non-stock");

console.log("Inventory stock status smoke OK");

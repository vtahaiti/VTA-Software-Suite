const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const inventoryPage = read("apps/web/app/dashboard/inventory/page.tsx");
const stockService = read("apps/api/src/stock/stock.service.ts");

assert(inventoryPage.includes("const tracked = isStockTracked(stock)"), "Inventory mobile UI must compute tracked-stock state before manual stock actions.");
assert(inventoryPage.includes("disabled={!tracked}"), "Inventory mobile UI must disable manual stock actions for non-stock rows.");
assert(inventoryPage.includes('"Non suivi"'), "Inventory mobile UI must show a clear label for non-stock rows.");
assert(inventoryPage.includes("Article non suivi"), "Inventory table must hide stock action buttons for non-stock rows.");
assert(inventoryPage.includes("isStockTracked(stock) ?"), "Inventory action rendering must branch on tracked-stock state.");

assert(stockService.includes("assertManualStockAllowed"), "Stock API must enforce non-stock protection server-side.");
assert(stockService.includes("isStockTrackedProduct(product)"), "Stock API must compute tracked stock centrally.");
assert(stockService.includes("isServiceOrNonStockProduct"), "Stock API must detect service/non-stock products before exposing stock actions.");
assert(stockService.includes("variantText") && stockService.includes("sans suivi") && stockService.includes("produit non stock"), "Stock API must rely on explicit non-stock markers instead of guessing from ordinary product names.");
assert(stockService.includes("Ce produit n'est pas suivi en stock."), "Stock API must return a clear non-stock error.");
assert(stockService.includes("await this.assertManualStockAllowed(tenantId, dto.productId);"), "Stock in/out must validate manual stock is allowed before movement.");
assert(stockService.includes("await this.assertManualStockAllowed(tenantId, productId);"), "Stock adjustment must validate manual stock is allowed before movement.");

console.log("Inventory non-stock actions smoke OK");

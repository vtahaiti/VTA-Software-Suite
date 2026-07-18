const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const apiService = fs.readFileSync(path.join(root, "apps/api/src/dashboard/dashboard.service.ts"), "utf8");
const apiController = fs.readFileSync(path.join(root, "apps/api/src/dashboard/dashboard.controller.ts"), "utf8");
const webDashboard = fs.readFileSync(path.join(root, "apps/web/app/dashboard/page.tsx"), "utf8");

assert(apiController.includes("summary(request.user.tenantId, request.user)"), "Dashboard API must pass the authenticated user to enforce role scope.");
assert(apiService.includes("dashboard:${tenantId}:${access}"), "Dashboard cache key must include role access scope.");
assert(apiService.includes('DashboardAccess = "FULL" | "MANAGER" | "CASHIER" | "STOCK" | "OBSERVER" | "BASIC"'), "Dashboard access roles must be explicit.");
assert(apiService.includes("restrictSummaryForAccess(result, access)"), "Dashboard response must be scoped before being returned.");
assert(apiService.includes("if (access === \"STOCK\")"), "Stock role must receive a stock-only dashboard.");
assert(apiService.includes("roleText.includes(\"CASHIER\")") && apiService.includes("permissions.has(\"pos.sell\")"), "Cashier dashboard access must be detected by role and permission fallback.");

assert(apiService.includes("stockValuation(activeStocks)"), "Dashboard must use the central stock valuation helper.");
assert(apiService.includes("stock.product?.isActive !== false"), "Inactive products must be excluded from stock valuation.");
assert(apiService.includes("if (quantity <= 0) continue;"), "Zero and negative stock must not inflate valuation.");
assert(apiService.includes("knownStockValue += quantity * cost.amount"), "Known stock value must use quantity times purchase/average cost.");
assert(apiService.includes("salePotentialValue += quantity * salePrice"), "Sale potential must use quantity times sale price.");
assert(apiService.includes("potentialKnownMargin += quantity * (salePrice - cost.amount)"), "Potential margin must require both cost and sale price.");
assert(apiService.includes("productsWithoutCost.add(productKey)"), "Dashboard must count products with missing purchase cost.");

assert(webDashboard.includes("isCashierDashboardUser(currentUser)") && webDashboard.includes('window.location.replace("/dashboard/pos")'), "Cashier users must be redirected from dashboard to POS.");
assert(webDashboard.includes("Valeur stock connue"), "Dashboard must show known stock value.");
assert(webDashboard.includes("Valeur de vente potentielle"), "Dashboard must show sale potential value.");
assert(webDashboard.includes("Marge potentielle connue"), "Dashboard must show known potential margin.");
assert(webDashboard.includes("valeur stock incomplete"), "Dashboard must warn when purchase costs are missing.");

console.log("Dashboard business smoke OK");

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const dashboardApi = read("apps/api/src/dashboard/dashboard.service.ts");
const dashboardWeb = read("apps/web/app/dashboard/page.tsx");
const posPage = read("apps/web/app/dashboard/pos/page.tsx");
const salesStatusPage = read("apps/web/app/dashboard/sales/sales-status-page.tsx");
const productsPage = read("apps/web/app/dashboard/products/page.tsx");
const productForm = read("apps/web/app/dashboard/products/product-form.tsx");
const usersPage = read("apps/web/app/dashboard/users/page.tsx");
const posApi = read("apps/api/src/pos/pos.service.ts");
const salesApi = read("apps/api/src/sales/sales.service.ts");

assert(dashboardApi.includes("stockValuation(activeStocks)"), "Dashboard must use scoped stock valuation.");
assert(dashboardApi.includes("if (quantity <= 0) continue;"), "Dashboard stock valuation must exclude zero stock.");
assert(dashboardApi.includes("salePotentialValue += quantity * salePrice"), "Dashboard must calculate sale potential from sale price.");
assert(dashboardApi.includes("potentialKnownMargin += quantity * (salePrice - cost.amount)"), "Dashboard must calculate potential margin only when cost and sale price are known.");
assert(dashboardWeb.includes("Valeur stock connue") && dashboardWeb.includes("Valeur de vente potentielle"), "Dashboard must expose clear stock valuation labels.");
assert(!dashboardWeb.includes('title="Valeur du stock"'), "Dashboard must not show the confusing zero-value legacy stock chart.");
assert(dashboardWeb.includes("isCashierDashboardUser") && dashboardWeb.includes('window.location.replace("/dashboard/pos")'), "Cashier dashboard must redirect to POS.");

assert(posPage.includes("isHoldingSale"), "POS must prevent double held sale submission.");
assert(posPage.includes("clearCurrentSale()"), "POS must clear cart/customer/payments after held sale save.");
assert(posPage.includes("Ancienne vente locale nettoy"), "POS must clear stale local drafts that no longer exist on the server.");
assert(posPage.includes("aucune vente en attente serveur associ"), "POS must not restore a local draft that has no server held-sale id.");
assert(posPage.includes("normalizeHeldSalesResponse"), "POS must normalize held-sale list responses before restoring local state.");
assert(posPage.includes("Nouvelle vente vide"), "POS must expose a clean new-sale reset state.");
assert(posPage.includes("Service / non stock"), "POS must distinguish services and non-stock products from out-of-stock products.");
assert(posPage.includes("product.stockTracked !== false"), "POS must avoid decrementing stock locally for non-stock products.");
assert(posApi.includes("stockTracked") && posApi.includes("private isStockTracked"), "POS API must expose stock tracking state.");
assert(salesApi.includes("isStockTrackedProduct") && salesApi.includes("hasTrackedStockElsewhere"), "Sales API must not require stock records for non-stock products.");
assert(salesStatusPage.includes("setDrafts(uniqueDrafts((data.items ?? []).map(normalizeDraft)))"), "Held sales page must avoid server/local duplicates.");
assert(salesStatusPage.includes("removeMatchingLocalDraft(draft)"), "Held sales cancel must clear matching local draft.");

assert(productForm.includes("<Section title=\"Essentiel produit\">"), "Product form must start with an essential section.");
assert(productForm.includes("Photo du produit"), "Product form must keep the product image option visible.");
assert(productForm.includes("<summary className=\"cursor-pointer text-lg font-semibold text-slate-950 dark:text-white\">Options avancées</summary>"), "Advanced product fields must stay collapsed by default.");
assert(!/Section title="Tarification"[\\s\\S]*placeholder="Prix achat"[\\s\\S]*placeholder="Prix vente"/.test(productForm), "Advanced pricing must not duplicate essential sale and purchase prices.");
assert(productsPage.includes("px-3 py-3 text-center text-sm font-bold"), "Mobile product edit button must remain large enough to tap.");
assert(productsPage.includes("costMissingOnly"), "Products page must keep the missing-cost filter.");
assert(productsPage.includes("Ajouter coût") && productsPage.includes("Modifier coût"), "Products page must expose quick purchase-cost editing.");
assert(productsPage.includes("purchasePrice: Number(quickCostValue || 0)"), "Quick cost edit must patch only the purchase cost.");

assert(usersPage.includes("roleTargetId"), "Users table must not show every role selector by default.");
assert(usersPage.includes("Changer rôle"), "Users table must expose an intentional role-change action.");
assert(usersPage.includes("setRoleTargetId(null)"), "Users role edit must close after role update or cancel.");

assert(salesStatusPage.includes("md:hidden"), "Sales history must use mobile cards below tablet width.");
assert(salesStatusPage.includes("md:block"), "Sales history desktop table must be hidden on mobile.");
assert(salesStatusPage.includes(">Imprimer</button>"), "Sales history mobile must expose print action.");
assert(salesStatusPage.includes("Voir detail") || salesStatusPage.includes("Voir d"), "Sales history mobile must expose detail action.");

console.log("client-ready essentials smoke OK");

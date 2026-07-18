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

assert(dashboardApi.includes("stockValuation(activeStocks)"), "Dashboard must use scoped stock valuation.");
assert(dashboardApi.includes("if (quantity <= 0) continue;"), "Dashboard stock valuation must exclude zero stock.");
assert(dashboardApi.includes("salePotentialValue += quantity * salePrice"), "Dashboard must calculate sale potential from sale price.");
assert(dashboardApi.includes("potentialKnownMargin += quantity * (salePrice - cost.amount)"), "Dashboard must calculate potential margin only when cost and sale price are known.");
assert(dashboardWeb.includes("Valeur stock connue") && dashboardWeb.includes("Valeur de vente potentielle"), "Dashboard must expose clear stock valuation labels.");
assert(dashboardWeb.includes("isCashierDashboardUser") && dashboardWeb.includes('window.location.replace("/dashboard/pos")'), "Cashier dashboard must redirect to POS.");

assert(posPage.includes("isHoldingSale"), "POS must prevent double held sale submission.");
assert(posPage.includes("clearCurrentSale()"), "POS must clear cart/customer/payments after held sale save.");
assert(salesStatusPage.includes("setDrafts(uniqueDrafts((data.items ?? []).map(normalizeDraft)))"), "Held sales page must avoid server/local duplicates.");
assert(salesStatusPage.includes("removeMatchingLocalDraft(draft)"), "Held sales cancel must clear matching local draft.");

assert(productForm.includes("<Section title=\"Essentiel produit\">"), "Product form must start with an essential section.");
assert(productForm.includes("Photo du produit"), "Product form must keep the product image option visible.");
assert(productForm.includes("<summary className=\"cursor-pointer text-lg font-semibold text-slate-950 dark:text-white\">Options avancées</summary>"), "Advanced product fields must stay collapsed by default.");
assert(!/Section title="Tarification"[\\s\\S]*placeholder="Prix achat"[\\s\\S]*placeholder="Prix vente"/.test(productForm), "Advanced pricing must not duplicate essential sale and purchase prices.");
assert(productsPage.includes("px-3 py-3 text-center text-sm font-bold"), "Mobile product edit button must remain large enough to tap.");

assert(salesStatusPage.includes("md:hidden"), "Sales history must use mobile cards below tablet width.");
assert(salesStatusPage.includes("md:block"), "Sales history desktop table must be hidden on mobile.");
assert(salesStatusPage.includes(">Imprimer</button>"), "Sales history mobile must expose print action.");
assert(salesStatusPage.includes("Voir detail") || salesStatusPage.includes("Voir d"), "Sales history mobile must expose detail action.");

console.log("client-ready essentials smoke OK");

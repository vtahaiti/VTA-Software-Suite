const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const salesDocument = read("apps/web/app/dashboard/sales/sales-document-page.tsx");
const products = read("apps/web/app/dashboard/products/page.tsx");
const dashboard = read("apps/web/app/dashboard/page.tsx");
const users = read("apps/web/app/dashboard/users/page.tsx");
const adminNotifications = read("apps/web/app/admin/notifications/page.tsx");
const adminTenants = read("apps/web/app/admin/tenants/page.tsx");

assert(salesDocument.includes("ProductResultCard"), "Devis & Commandes must use compact product result cards.");
assert(!salesDocument.includes('<select value={catalogDraft.productId}'), "Product picker must not use the heavy native select.");
assert(!salesDocument.includes("product.sku} - {product.name}"), "Product picker must not show full SKU in every option.");
assert(salesDocument.includes("Produit selectionne") && salesDocument.includes("SKU:"), "SKU must remain visible after product selection.");

assert(products.includes("Cout non renseigne"), "Products page must still flag missing costs.");
assert(products.includes("text-amber-600/80"), "Missing-cost label must stay visually discreet.");
assert(products.includes("ProductTypeHint") && products.includes("ProductStockDisplay"), "Product list must separate type hint and stock display.");

assert(dashboard.includes("CashierDashboard"), "Dashboard must provide a role-specific cashier view.");
assert(dashboard.includes("Valeur potentielle = prix de vente x stock disponible"), "Dashboard must explain potential stock value.");
assert(dashboard.includes("marge reelle non calculable"), "Dashboard must explain missing-cost margin limits.");

assert(users.includes("comptes actifs affiches"), "Users count label must not claim hidden owners are counted.");

assert(!adminNotifications.includes("payload.tenants?.[0]?.id"), "Admin notifications must not preselect a tenant.");
assert(adminNotifications.includes("Choisir une entreprise"), "Admin notifications must expose an empty tenant choice.");
assert(adminNotifications.includes("selectedCount <= 0 || !title.trim() || !message.trim()"), "Admin notification send button must be disabled until complete.");

assert(adminTenants.includes("canReactivate") && adminTenants.includes("canSuspend"), "Admin companies actions must depend on status.");
assert(!adminTenants.includes("#danger-zone`} className=\"rounded-full"), "Admin companies list must not expose danger zone directly.");

console.log("client UX finish smoke OK");

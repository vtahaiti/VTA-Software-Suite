const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = {
  service: path.join(root, "apps/api/src/platform/platform.service.ts"),
  dashboard: path.join(root, "apps/web/app/admin/page.tsx"),
  tenants: path.join(root, "apps/web/app/admin/tenants/page.tsx"),
  detail: path.join(root, "apps/web/app/admin/tenants/[id]/page.tsx")
};

const read = (file) => fs.readFileSync(file, "utf8");
const service = read(files.service);
const ui = [files.dashboard, files.tenants, files.detail].map(read).join("\n");

const forbiddenServicePatterns = [
  "SaleStatus",
  "prisma.sale",
  "prisma.saleItem",
  "prisma.product.count",
  "prisma.invoice.count",
  "prisma.payment.aggregate",
  "globalSales",
  "profitByTenant",
  "salesStatsByTenant"
];

const forbiddenUiPatterns = [
  "CA global",
  "CA total",
  "Chiffre d'affaires",
  "Ventes globales",
  "Profit:",
  "Produits</th>",
  "Factures</th>",
  "Paiements reçus"
];

const failures = [];
for (const pattern of forbiddenServicePatterns) {
  if (service.includes(pattern)) failures.push(`platform.service.ts still contains forbidden business query/reference: ${pattern}`);
}
for (const pattern of forbiddenUiPatterns) {
  if (ui.includes(pattern)) failures.push(`admin UI still contains forbidden business metric label: ${pattern}`);
}
if (!service.includes("Nettoyage global désactivé")) failures.push("deleteDemoTenants is not explicitly disabled.");
if (!service.includes("Un motif est obligatoire")) failures.push("Sensitive tenant status/delete actions do not require a reason.");
if (!ui.includes("Les ventes, produits, stocks, factures et clients privés ne sont pas exposés")) failures.push("Tenant list does not state the privacy boundary.");
if (!ui.includes("Aucune donnée métier privée")) failures.push("Tenant detail does not state the privacy boundary.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Platform Control Center smoke test passed.");

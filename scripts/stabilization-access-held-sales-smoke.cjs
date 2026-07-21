const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const salesPage = read("apps/web/app/dashboard/sales/sales-status-page.tsx");
const dashboardPage = read("apps/web/app/dashboard/page.tsx");
const protectedShell = read("apps/web/components/protected-shell.tsx");
const salesController = read("apps/api/src/sales/sales.controller.ts");
const salesService = read("apps/api/src/sales/sales.service.ts");
const dashboardService = read("apps/api/src/dashboard/dashboard.service.ts");

assert(salesPage.includes("fetchWithAuth(`${apiUrl}/pos/held-sales`)"), "Held sales page must use fetchWithAuth.");
assert(!salesPage.includes("setDrafts(loadDrafts())"), "Held sales page must not fall back to localStorage drafts after server failure.");
assert(!salesPage.includes("function loadDrafts"), "Local draft loading must not be used as the in-progress sales source.");
assert(salesPage.includes("response?.status === 403"), "Held sales page must treat 403 distinctly.");
assert(salesPage.includes("setAccessBlocked(true)"), "Held sales page must show a blocked access state on 403.");
assert(salesPage.includes("setDrafts([])"), "Held sales page must clear visible drafts when access is blocked.");
assert(salesPage.includes("Impossible de charger les ventes en attente du serveur."), "Server failure message must not announce local drafts.");

assert(dashboardPage.includes("fetchWithAuth(`${apiUrl}/dashboard/summary`"), "Dashboard must use fetchWithAuth.");
assert(dashboardPage.includes("response.status === 403"), "Dashboard must treat paused/suspended 403 distinctly.");
assert(dashboardPage.includes("DashboardAccessBlocked"), "Dashboard must show a clean blocked access screen.");

assert(protectedShell.includes("TenantAccessBlocked"), "Protected shell must keep the global tenant blocked screen.");
assert(protectedShell.includes("clearTenantScopedCaches(\"tenant-blocked\")"), "Tenant blocked state must clear tenant-scoped caches.");

assert(salesController.includes("await this.service.findOne(req.user.tenantId, id, req.user)"), "Receipt endpoint must enforce cashier sale access.");
assert(salesController.includes("this.service.findOne(req.user.tenantId, id, req.user)"), "Sale detail endpoint must enforce cashier sale access.");
assert(salesService.includes("Accès interdit à la vente d'un autre caissier"), "Sales service must reject direct access to another cashier sale.");
assert(salesService.includes("sale.createdById !== access.forcedUserId"), "Sales service must compare sale creator against limited user.");

assert(dashboardService.includes("restrictSummaryForAccess(result, access)"), "Dashboard must restrict sensitive data by role.");
assert(dashboardService.includes("\"CASHIER\"") && dashboardService.includes("CAISSIER"), "Dashboard access model must include cashier scope.");
assert(dashboardService.includes("topSalesTable: []"), "Restricted dashboard must remove admin sales tables.");

const touchedFiles = [
  "apps/web/app/dashboard/sales/sales-status-page.tsx",
  "apps/web/app/dashboard/page.tsx",
  "apps/web/components/protected-shell.tsx",
  "apps/api/src/sales/sales.service.ts",
  "apps/api/src/sales/sales.controller.ts"
];
const mojibake = ["Ã", "Â", "�"];
for (const file of touchedFiles) {
  const content = read(file);
  for (const marker of mojibake) {
    assert(!content.includes(marker), `${file} contains mojibake marker ${JSON.stringify(marker)}`);
  }
}

console.log("stabilization access and held sales smoke OK");

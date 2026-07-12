const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const salesPage = read("apps/web/app/dashboard/sales/sales-status-page.tsx");
assert(salesPage.includes("/pos/held-sales"), "In-progress sales page must use /pos/held-sales.");
assert(!salesPage.includes('status: "PENDING"') && !salesPage.includes('status=PENDING'), "In-progress sales page must not call invalid PENDING sale status.");
assert(salesPage.includes("/dashboard/pos"), "Held sale resume must route back to POS.");

const posPage = read("apps/web/app/dashboard/pos/page.tsx");
assert(posPage.includes("taxEnabled") && posPage.includes('setTaxRate("0")'), "POS must default tax to 0 unless taxEnabled is true.");
assert(posPage.includes("/pos/held-sales"), "POS hold action must persist held sales through /pos/held-sales.");
assert(posPage.includes("heldSaleId"), "POS must track heldSaleId for cleanup after finalization.");

const apiSchema = read("apps/api/prisma/schema.prisma");
assert(apiSchema.includes("model HeldSale"), "API Prisma schema must define HeldSale.");
assert(apiSchema.includes("taxEnabled Boolean @default(false)"), "TenantSettings must include taxEnabled default false.");
assert(apiSchema.includes("defaultTaxRate Decimal @default(0)"), "defaultTaxRate must default to 0.");

const controller = read("apps/api/src/pos/pos.controller.ts");
assert(controller.includes('@Get("held-sales")'), "POS controller must expose GET /pos/held-sales.");
assert(controller.includes('@Post("held-sales")'), "POS controller must expose POST /pos/held-sales.");
assert(controller.includes('@Delete("held-sales/:id")'), "POS controller must expose DELETE /pos/held-sales/:id.");

const settingsDto = read("apps/api/src/settings/dto/settings.dto.ts");
assert(settingsDto.includes("taxEnabled"), "Invoicing settings DTO must accept taxEnabled.");

const migration = path.join(root, "apps/api/prisma/migrations/20260712061000_held_sales_tax_enabled/migration.sql");
assert(fs.existsSync(migration), "HeldSale/taxEnabled migration must exist for API schema.");

console.log("held-sales-tax-contract-smoke: ok");
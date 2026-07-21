const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

const dto = read("apps/api/src/stock/dto/stock-operation.dto.ts");
const service = read("apps/api/src/stock/stock.service.ts");
const controller = read("apps/api/src/stock/stock.controller.ts");
const roles = read("apps/api/src/users/tenant-role-presets.ts");
const inventoryPage = read("apps/web/app/dashboard/inventory/page.tsx");

const requiredReasons = [
  "CASSE",
  "PERTE",
  "UTILISATION_INTERNE",
  "CORRECTION_INVENTAIRE",
  "AUTRE"
];

for (const reason of requiredReasons) {
  assert(dto.includes(`"${reason}"`), `stock out reason ${reason} is declared in DTO`);
  assert(inventoryPage.includes(reason), `stock out reason ${reason} is available in inventory UI`);
}

assert(dto.includes("STOCK_OUT_REASONS"), "controlled stock out reasons are centralized");
assert(service.includes("!dto.reason") && service.includes("STOCK_OUT_REASONS.includes(dto.reason)"), "stock out requires a controlled reason");
assert(service.includes("InventoryMovementType.OUT") && service.includes("-dto.quantity"), "stock out writes an OUT movement with negative stock delta");
assert(service.includes("afterQty < 0") && service.includes("Stock insuffisant"), "stock out blocks quantities above available stock");
assert(service.includes("beforeQty: stock.quantity"), "movement audit stores stock before");
assert(service.includes("afterQty"), "movement audit stores stock after");
assert(service.includes("userId: dto.userId"), "movement audit stores acting user");
assert(service.includes("reason: dto.reason ?? dto.note"), "movement audit stores controlled reason");
assert(service.includes("note: dto.note"), "movement audit stores optional note");

assert(controller.includes('@Post("out")') && controller.includes('@Permissions("inventory.adjust")'), "stock out endpoint requires inventory.adjust");
assert(controller.includes("userId:req.user.id") || controller.includes("userId: req.user.id"), "stock out endpoint injects authenticated user");

const cashierBlock = roles.match(/CAISSIER:[\s\S]*?STOCK:/)?.[0] ?? "";
const stockBlock = roles.match(/STOCK:[\s\S]*?COMPTABLE:/)?.[0] ?? "";
const managerBlock = roles.match(/MANAGER:[\s\S]*?OBSERVATEUR:/)?.[0] ?? "";

assert(!cashierBlock.includes("inventory.adjust") && !cashierBlock.includes("inventory."), "CAISSIER cannot adjust stock");
assert(stockBlock.includes('"inventory."'), "STOCK role receives inventory permissions");
assert(managerBlock.includes('"inventory."'), "MANAGER role receives inventory permissions");

assert(inventoryPage.includes("Sortie stock"), "inventory UI exposes a clear stock out action");
assert(inventoryPage.includes("Motif obligatoire"), "inventory UI requires a stock out reason");
assert(inventoryPage.includes("ne crée aucune vente"), "inventory UI states stock out creates no sale");

if (process.exitCode) process.exit(process.exitCode);

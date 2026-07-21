const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const inventoryPage = read("apps/web/app/dashboard/inventory/page.tsx");
const stockQueryDto = read("apps/api/src/stock/dto/stock-query.dto.ts");
const stockService = read("apps/api/src/stock/stock.service.ts");
const stockController = read("apps/api/src/stock/stock.controller.ts");
const inventoryService = read("apps/api/src/inventory/inventory.service.ts");
const roles = read("apps/api/src/users/tenant-role-presets.ts");

function stockStatus(stock) {
  if (stock.stockTracked === false) return "NON_STOCK";
  if (stock.quantity <= 0) return "OUT_OF_STOCK";
  if (stock.quantity <= stock.minimumStock) return "LOW_STOCK";
  return "IN_STOCK";
}

assert.equal(stockStatus({ quantity: 0, minimumStock: 2 }), "OUT_OF_STOCK", "stock 0 = rupture");
assert.equal(stockStatus({ quantity: 1, minimumStock: 2 }), "LOW_STOCK", "stock <= minimum = stock faible");
assert.equal(stockStatus({ quantity: 5, minimumStock: 2 }), "IN_STOCK", "stock > minimum = en stock");
assert.equal(stockStatus({ quantity: 0, minimumStock: 0, stockTracked: false }), "NON_STOCK", "non-stock n'est pas une rupture");

assert(stockQueryDto.includes("includeNonStock"), "StockQueryDto expose includeNonStock.");
assert(inventoryPage.includes('includeNonStock: showNonStock ? "true" : "false"'), "Inventaire masque les non-stock par défaut.");
assert(stockService.includes("query.includeNonStock ? items : items.filter((item) => item.stockTracked)"), "API stock filtre les non-stock par défaut.");
assert(inventoryPage.includes("Afficher les articles non suivis"), "UI propose un filtre secondaire non-stock.");

for (const label of ["Produit", "Catégorie", "Emplacement", "Quantité actuelle", "Minimum", "Statut", "Actions"]) {
  assert(inventoryPage.includes(label), `colonne inventaire attendue: ${label}`);
}
for (const label of ["Entrée stock", "Sortie stock", "Transfert", "Historique"]) {
  assert(inventoryPage.includes(label), `action inventaire attendue: ${label}`);
}
assert(inventoryPage.includes("Correction inventaire") && inventoryPage.includes("Options avancées"), "Correction inventaire reste en option avancée.");
assert(inventoryPage.includes("Motif obligatoire"), "Sortie stock demande un motif obligatoire.");
assert(inventoryPage.includes("ne crée aucune vente"), "Sortie stock ne doit pas être présentée comme une vente.");

assert(stockController.includes('@Post("in")') && stockController.includes('@Permissions("inventory.adjust")'), "Entrée stock protégée par inventory.adjust.");
assert(stockController.includes('@Post("out")') && stockController.includes('@Permissions("inventory.adjust")'), "Sortie stock protégée par inventory.adjust.");
assert(stockService.includes("InventoryMovementType.IN") && stockService.includes("dto.quantity"), "Entrée augmente le stock.");
assert(stockService.includes("InventoryMovementType.OUT") && stockService.includes("-dto.quantity"), "Sortie diminue le stock.");
assert(stockService.includes("afterQty < 0") && stockService.includes("Stock insuffisant"), "Sortie bloque le stock négatif.");

assert(inventoryPage.includes("/inventory/transfers"), "Transfert stock utilise l'endpoint transfers.");
assert(inventoryService.includes("Transfert sortant") && inventoryService.includes("Transfert entrant"), "Transfert crée les mouvements source/destination.");
assert(inventoryService.includes('reason: "CORRECTION_INVENTAIRE"'), "Transfert fournit un motif contrôlé au stockOut.");
assert(inventoryPage.includes("sans changer la quantité globale"), "UI précise que le transfert ne change pas le total global.");

const cashierBlock = roles.match(/CAISSIER:[\s\S]*?STOCK:/)?.[0] ?? "";
const stockBlock = roles.match(/STOCK:[\s\S]*?COMPTABLE:/)?.[0] ?? "";
assert(!cashierBlock.includes("inventory.view") && !cashierBlock.includes("inventory.adjust"), "CAISSIER sans accès inventaire.");
assert(stockBlock.includes('"inventory."'), "Rôle STOCK garde les permissions inventaire.");

for (const location of ["Dépôt principal", "Réfrigérateur", "Cuisine", "Bar"]) {
  assert(inventoryPage.includes(location), `emplacement restaurant prévu: ${location}`);
}

assert(!inventoryPage.includes("createProduct") && !inventoryPage.includes("Nouveau produit"), "Inventaire ne crée plus de produit depuis la page principale.");
assert(!inventoryPage.includes("/sales"), "Inventaire ne doit pas créer de vente.");

console.log("Inventory V1 smoke OK");

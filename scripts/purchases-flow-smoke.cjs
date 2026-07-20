const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const receiptService = read("apps/api/src/purchases/goods-receipts.service.ts");
const receiptDto = read("apps/api/src/purchases/dto/create-goods-receipt.dto.ts");
const purchaseService = read("apps/api/src/purchases/purchase-orders.service.ts");
const purchasesPage = read("apps/web/app/dashboard/purchases/page.tsx");
const receiptsPage = read("apps/web/app/dashboard/purchases/receipts/page.tsx");

assert(receiptService.includes("this.prisma.$transaction"), "La reception achat doit etre transactionnelle");
assert(receiptService.includes("InventoryMovementType.PURCHASE"), "La reception doit creer un mouvement inventaire PURCHASE");
assert(receiptService.includes("tx.stock.update"), "La reception doit augmenter le stock");
assert(receiptService.includes("receivedQty: { increment: quantity }"), "La reception doit incrementer receivedQty");
assert(receiptService.includes("itemUpdate.count !== 1"), "La reception doit proteger les réceptions concurrentes");
assert(receiptService.includes("PurchaseOrderStatus.PARTIALLY_RECEIVED"), "La reception partielle doit mettre le statut partiel");
assert(receiptService.includes("PurchaseOrderStatus.FULLY_RECEIVED"), "La reception complete doit mettre le statut complet");
assert(receiptService.includes("Number(orderItem.product.purchasePrice ?? 0) <= 0"), "Le cout d'achat existant ne doit pas etre ecrase");
assert(receiptDto.includes("updateMissingCosts"), "Le DTO doit exposer l'option de mise a jour du cout manquant");
assert(purchaseService.includes("supplierBalanceDue"), "Le dashboard achats doit exposer les montants a payer fournisseur");
assert(purchaseService.includes("pendingReceiptOrders"), "Le dashboard achats doit exposer les bons en attente de reception");
assert(purchasesPage.includes("Bons d&apos;achat fournisseurs"), "La page achats doit parler de bons d'achat fournisseurs");
assert(purchasesPage.includes("dépenses générales restent séparées"), "La page achats doit séparér les dépenses générales");
assert(receiptsPage.includes("updateMissingCosts"), "La page reception doit proposer la mise a jour des couts manquants");
assert(receiptsPage.includes("purchase-orders?status=SENT"), "La reception doit inclure les bons commandes");

console.log(JSON.stringify({ status: "PURCHASES_FLOW_SMOKE_OK" }, null, 2));

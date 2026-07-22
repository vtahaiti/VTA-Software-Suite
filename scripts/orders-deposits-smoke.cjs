const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const salesDocumentPage = read("apps/web/app/dashboard/sales/sales-document-page.tsx");
const detailPage = read("apps/web/app/dashboard/sales/sales-document-detail-page.tsx");
const proformasService = read("apps/api/src/sales/proformas.service.ts");
const quotesService = read("apps/api/src/sales/quotes.service.ts");
const schema = read("database/prisma/schema.prisma");

function calculateTotals(items, discount = 0) {
  for (const item of items) {
    if (!item.productId && !String(item.customName ?? "").trim()) {
      throw new Error("Chaque ligne doit contenir un produit ou un service.");
    }
  }
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscount = items.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const tax = items.reduce((sum, item) => sum + (item.tax ?? 0), 0);
  const total = subtotal - discount - lineDiscount + tax;
  if (total < 0) throw new Error("Total invalide");
  return { subtotal, discount: discount + lineDiscount, tax, total, paidAmount: 0, balance: total };
}

function applyPayment(order, amount) {
  if (amount <= 0) throw new Error("Montant invalide");
  if (amount > order.balance) throw new Error("Paiement supérieur à la balance");
  const paidAmount = order.paidAmount + amount;
  const balance = order.total - paidAmount;
  return { ...order, paidAmount, balance, paymentStatus: balance <= 0 ? "PAID" : "PARTIALLY_PAID", status: order.status };
}

const quote = calculateTotals([
  { productId: "product-1", quantity: 2, unitPrice: 100, discount: 10, tax: 0 },
  { customName: "Pose et ajustement", quantity: 1, unitPrice: 75, discount: 0, tax: 0 }
], 5);
assert.deepStrictEqual(quote, { subtotal: 275, discount: 15, tax: 0, total: 260, paidAmount: 0, balance: 260 });

const confirmedOrder = { ...quote, status: "CONFIRMED", paymentStatus: "UNPAID" };
const withAdvance = applyPayment(confirmedOrder, 60);
assert.equal(withAdvance.status, "CONFIRMED", "Le paiement ne doit pas remplacer le statut opérationnel.");
assert.equal(withAdvance.paymentStatus, "PARTIALLY_PAID");
assert.equal(withAdvance.balance, 200);
const paid = applyPayment(withAdvance, 200);
assert.equal(paid.balance, 0);
assert.equal(paid.paymentStatus, "PAID");
assert.throws(() => calculateTotals([{ quantity: 1, unitPrice: 1 }]), /produit ou un service/);

for (const label of [
  "A) Produit du catalogue",
  "B) Ligne personnalisée ou service",
  "Ajouter au devis",
  "Ajouter à la commande",
  "Rechercher un produit",
  "Produit sélectionné",
  "Total",
  "Avance",
  "Balance",
  "Le devis prépare un prix imprimable. Il ne modifie pas le stock et ne crée pas de vente POS."
]) {
  assert(salesDocumentPage.includes(label), `Libellé Devis & Commandes attendu: ${label}`);
}

assert(salesDocumentPage.includes("/products?${query.toString()}"), "La recherche produit doit appeler l'API produits avec les paramètres serveur.");
assert(salesDocumentPage.includes("setProducts((current)"), "Les résultats produits recherchés doivent être fusionnés pour garder la sélection.");
assert(!salesDocumentPage.includes("product.sku} - {product.name}"), "La liste produit ne doit pas afficher SKU complet + nom + prix.");
assert(detailPage.includes("Annuler la commande"), "L'annulation doit rester visible dans le détail commande.");
assert(!detailPage.includes("Marquer livrée"), "Le pipeline de livraison en plusieurs étapes doit être retiré.");
assert(detailPage.includes("Vente terminée"), "Une commande soldée doit afficher Vente terminée.");
assert(detailPage.includes("signature") || detailPage.includes("Signature"), "Le devis imprimable doit prévoir une zone de signature.");
assert(detailPage.includes("N° client"), "Le document imprimé doit afficher le numéro du client.");
assert(detailPage.includes("Avance / balance enregistrée."), "Le détail commande doit enregistrer avance/balance.");

assert(schema.includes("paymentStatus  SalesDocumentPaymentStatus"), "Le statut financier doit être séparé du statut opérationnel.");
assert(schema.includes("ORDER_DELIVERY"), "La sortie de stock à la commande doit avoir un mouvement inventaire distinct.");
assert(quotesService.includes("status: SalesDocumentStatus.CONFIRMED"), "La conversion devis -> commande doit sortir le stock immédiatement (statut confirmé).");
assert(proformasService.includes("deductStockForItems"), "La création de commande doit décrémenter le stock directement, sans réservation intermédiaire.");
assert(!proformasService.includes("reserveProductLine"), "La réservation de stock à la confirmation ne doit plus exister : le stock sort dès la création.");
assert(proformasService.includes("Paiement supérieur à la balance"), "Le surpaiement doit être refusé.");
assert(!proformasService.includes("this.prisma.sale.create"), "Une commande ne doit pas créer de vente POS cachée.");

console.log("orders-deposits smoke: ok");

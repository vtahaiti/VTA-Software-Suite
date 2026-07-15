const assert = require("assert");

const orderStatuses = ["CONFIRMED", "IN_PROGRESS", "READY", "DELIVERED", "COMPLETED", "CANCELLED"];

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
  if (amount > order.balance) throw new Error("Paiement superieur au solde");
  const paidAmount = order.paidAmount + amount;
  const balance = order.total - paidAmount;
  return { ...order, paidAmount, balance, status: balance <= 0 ? "PAID" : "PARTIALLY_PAID" };
}

const quote = calculateTotals([
  { productId: "product-1", quantity: 2, unitPrice: 100, discount: 10, tax: 0 },
  { customName: "Pose et ajustement", quantity: 1, unitPrice: 75, discount: 0, tax: 0 }
], 5);
assert.deepStrictEqual(quote, { subtotal: 275, discount: 15, tax: 0, total: 260, paidAmount: 0, balance: 260 });

const order = { ...quote, status: "CONFIRMED" };
assert(orderStatuses.includes(order.status), "commande confirmee attendue");
const withDeposit = applyPayment(order, 60);
assert.strictEqual(withDeposit.paidAmount, 60);
assert.strictEqual(withDeposit.balance, 200);
assert.strictEqual(withDeposit.status, "PARTIALLY_PAID");
const paid = applyPayment(withDeposit, 200);
assert.strictEqual(paid.balance, 0);
assert.strictEqual(paid.status, "PAID");
assert.throws(() => calculateTotals([{ quantity: 1, unitPrice: 1 }]), /produit ou un service/);

const fabricationLine = {
  customName: "Fenetre aluminium QA",
  customType: "FENETRE",
  customNote: [
    "Materiau: Aluminium",
    "Largeur: 120 cm",
    "Hauteur: 90 cm",
    "Couleur: Blanc",
    "Epaisseur / verre: 6 mm",
    "Date prevue: 2026-07-30",
    "Livraison / installation: Adresse QA",
    "Notes de mesure: Mesures QA non persistantes"
  ].join("\n"),
  quantity: 2,
  unitPrice: 1500,
  discount: 0,
  tax: 0
};
const fabricationQuote = calculateTotals([fabricationLine]);
assert.strictEqual(fabricationQuote.total, 3000);
assert.match(fabricationLine.customNote, /Largeur: 120 cm/);
assert.match(fabricationLine.customNote, /Livraison \/ installation: Adresse QA/);

console.log("orders-deposits smoke: ok");

const assert = require("node:assert/strict");

function availableStock(stock) {
  return Number(stock.quantity ?? 0) - Number(stock.reserved ?? 0);
}

function isLowStock(stock) {
  return availableStock(stock) <= Number(stock.minimumStock ?? 0);
}

function summarizeStockByProduct(stocks) {
  const products = new Map();
  for (const stock of stocks) {
    const id = stock.productId;
    const current = products.get(id) ?? { available: 0, minimumStock: 0 };
    current.available += availableStock(stock);
    current.minimumStock = Math.max(current.minimumStock, Number(stock.minimumStock ?? 0));
    products.set(id, current);
  }
  return [...products.values()];
}

function lowStockProductCount(stocks) {
  return summarizeStockByProduct(stocks).filter((stock) => stock.available <= stock.minimumStock).length;
}

function knownUnitCost(product) {
  if (Number(product.averageCost ?? 0) > 0) return { known: true, amount: Number(product.averageCost) };
  if (Number(product.purchasePrice ?? 0) > 0) return { known: true, amount: Number(product.purchasePrice) };
  return { known: false, amount: null };
}

function stockValue(stock, product) {
  const cost = knownUnitCost(product);
  return cost.known ? availableStock(stock) * cost.amount : null;
}


function summarizePayments(totalValue, payments = []) {
  const total = Math.round(Number(totalValue ?? 0) * 100) / 100;
  const rawSettled = Math.round(payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) * 100) / 100;
  const explicitReceived = payments.some((payment) => payment.receivedAmount !== null && payment.receivedAmount !== undefined);
  const explicitChange = payments.some((payment) => payment.changeAmount !== null && payment.changeAmount !== undefined && Number(payment.changeAmount ?? 0) > 0);
  const receivedAmount = Math.round(payments.reduce((sum, payment) => sum + Number(payment.receivedAmount ?? payment.amount ?? 0), 0) * 100) / 100;
  const recordedChange = Math.round(payments.reduce((sum, payment) => sum + Number(payment.changeAmount ?? 0), 0) * 100) / 100;
  if (!explicitReceived && !explicitChange && rawSettled > total && total > 0) return { total, settledAmount: total, receivedAmount: rawSettled, changeAmount: rawSettled - total };
  return { total, settledAmount: Math.min(rawSettled, total), receivedAmount, changeAmount: explicitChange ? recordedChange : Math.max(0, receivedAmount - total) };
}

function profitSummary(items) {
  let revenue = 0;
  let knownCost = 0;
  let missingCostLines = 0;
  for (const item of items) {
    revenue += item.revenue;
    const cost = knownUnitCost(item.product ?? {});
    if (!cost.known) {
      missingCostLines += 1;
      continue;
    }
    knownCost += cost.amount * item.quantity;
  }
  return { revenue, knownCost, missingCostLines, reliable: missingCostLines === 0, profit: missingCostLines === 0 ? revenue - knownCost : null, margin: missingCostLines === 0 && revenue > 0 ? ((revenue - knownCost) / revenue) * 100 : null };
}

function paymentRows(payments, total) {
  let remaining = total;
  let overpaymentAssigned = false;
  return payments.filter((payment) => payment.amount > 0).map((payment) => {
    const receivedAmount = payment.amount;
    const amount = Math.min(receivedAmount, remaining);
    remaining = Math.max(0, remaining - amount);
    const changeAmount = !overpaymentAssigned && payment.method === "CASH" && receivedAmount > amount ? receivedAmount - amount : 0;
    if (changeAmount > 0) overpaymentAssigned = true;
    return { ...payment, amount, receivedAmount, changeAmount };
  });
}

assert.equal(availableStock({ quantity: 10, reserved: 3 }), 7, "Le disponible doit tenir compte des reservations.");
assert.equal(isLowStock({ quantity: 5, reserved: 0, minimumStock: 5 }), true, "Disponible egal au minimum = stock faible.");
assert.equal(isLowStock({ quantity: 6, reserved: 2, minimumStock: 5 }), true, "Disponible apres reservation doit declencher l'alerte.");
const sevenProducts = [
  { productId: "p1", quantity: 5, reserved: 0, minimumStock: 5 },
  { productId: "p2", quantity: 4, reserved: 0, minimumStock: 5 },
  { productId: "p3", quantity: 3, reserved: 0, minimumStock: 5 },
  { productId: "p4", quantity: 2, reserved: 0, minimumStock: 5 },
  { productId: "p5", quantity: 1, reserved: 0, minimumStock: 5 },
  { productId: "p6", quantity: 7, reserved: 2, minimumStock: 5 },
  { productId: "p7", quantity: 8, reserved: 0, minimumStock: 5 },
  { productId: "p1", quantity: 0, reserved: 0, minimumStock: 5 }
];
assert.equal(lowStockProductCount(sevenProducts), 6, "Dashboard, inventaire et rapports doivent compter les memes produits faibles.");
assert.equal(stockValue({ quantity: 10, reserved: 0 }, { purchasePrice: 12, averageCost: 0 }), 120, "Valeur stock avec cout connu.");
assert.equal(stockValue({ quantity: 10, reserved: 0 }, { purchasePrice: 0, averageCost: 0 }), null, "Cout absent ne doit pas devenir une marge fiable.");
assert.equal(stockValue({ quantity: 10, reserved: 0 }, { purchasePrice: 0, averageCost: 0 }), null, "Cout absent = valeur partielle signalee.");
assert.equal(stockValue({ quantity: 10, reserved: 0 }, { purchasePrice: 0, averageCost: 15 }), 150, "Cout moyen pondere connu prioritaire.");

const [cashPayment] = paymentRows([{ method: "CASH", amount: 3000 }], 2500);
assert.equal(cashPayment.amount, 2500, "Le montant regle ne doit pas depasser le total.");
assert.equal(cashPayment.receivedAmount, 3000, "Le montant recu doit rester disponible.");
assert.equal(cashPayment.changeAmount, 500, "La monnaie doit etre separee du montant regle.");


const exactSummary = summarizePayments(2500, [{ method: "CASH", amount: 2500, receivedAmount: 2500, changeAmount: 0 }]);
assert.deepEqual(exactSummary, { total: 2500, settledAmount: 2500, receivedAmount: 2500, changeAmount: 0 }, "Paiement exact invalide.");
const overpaidLegacy = summarizePayments(1250, [{ method: "CASH", amount: 1500, receivedAmount: null, changeAmount: 0 }]);
assert.equal(overpaidLegacy.settledAmount, 1250, "Ancienne vente: montant regle doit etre plafonne au total.");
assert.equal(overpaidLegacy.receivedAmount, 1500, "Ancienne vente: montant recu doit etre conserve.");
assert.equal(overpaidLegacy.changeAmount, 250, "Ancienne vente: monnaie doit etre reconstruite si possible.");
const overpaidLarge = summarizePayments(8550, [{ method: "CASH", amount: 15000, receivedAmount: null, changeAmount: 0 }]);
assert.equal(overpaidLarge.changeAmount, 6450, "Monnaie incorrecte sur gros trop-percu.");
const insufficientSummary = summarizePayments(2500, [{ method: "CASH", amount: 2000 }]);
assert.equal(insufficientSummary.settledAmount, 2000, "Paiement insuffisant doit rester insuffisant et bloque par le service POS.");
const mixedPayments = paymentRows([{ method: "CARD", amount: 1000 }, { method: "CASH", amount: 2000 }], 2500);
assert.equal(mixedPayments[0].amount, 1000, "Paiement carte doit etre applique tel quel.");
assert.equal(mixedPayments[1].amount, 1500, "Paiement cash doit regler uniquement le reste.");
assert.equal(mixedPayments[1].changeAmount, 500, "Monnaie cash multi-paiement invalide.");
const reliableProfit = profitSummary([{ revenue: 1000, quantity: 2, product: { averageCost: 200, purchasePrice: 0 } }]);
assert.equal(reliableProfit.profit, 600, "Profit fiable avec cout connu invalide.");
assert.equal(reliableProfit.margin, 60, "Marge fiable avec cout connu invalide.");
const missingProfit = profitSummary([{ revenue: 1000, quantity: 2, product: { averageCost: 0, purchasePrice: 0 } }]);
assert.equal(missingProfit.profit, null, "Cout absent ne doit pas produire un profit fiable.");
assert.equal(missingProfit.margin, null, "Cout absent ne doit pas produire 100% de marge.");
const partialMissingProfit = profitSummary([{ revenue: 500, quantity: 1, product: { averageCost: 100 } }, { revenue: 500, quantity: 1, product: { averageCost: 0, purchasePrice: 0 } }]);
assert.equal(partialMissingProfit.profit, null, "Couts partiels manquants doivent rendre le profit global non calculable.");
const zeroCostProfit = profitSummary([{ revenue: 500, quantity: 1, product: { averageCost: 0, purchasePrice: 0 } }]);
assert.equal(zeroCostProfit.reliable, false, "Un cout nul non qualifie reste inconnu dans la regle actuelle.");

const archivedCategory = { archivedAt: new Date().toISOString(), products: 0 };
assert.equal(Boolean(archivedCategory.archivedAt), true, "Une categorie archivee reste restaurable et cachee des selecteurs standards.");

console.log("Business rules smoke tests OK");

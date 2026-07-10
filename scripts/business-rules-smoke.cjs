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

const archivedCategory = { archivedAt: new Date().toISOString(), products: 0 };
assert.equal(Boolean(archivedCategory.archivedAt), true, "Une categorie archivee reste restaurable et cachee des selecteurs standards.");

console.log("Business rules smoke tests OK");

const { PrismaClient, InventoryMovementType, SaleStatus, SalesDocumentStatus, PaymentMethod } = require("@prisma/client");

const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getStock(tenantId, productId, warehouseId) {
  const stock = await prisma.stock.findUnique({
    where: { tenantId_productId_warehouseId: { tenantId, productId, warehouseId } }
  });
  return stock?.quantity ?? 0;
}

async function moveStock({ tenantId, productId, warehouseId, type, quantity, delta, reference, note, userId, storeId }) {
  const stock = await prisma.stock.findUnique({
    where: { tenantId_productId_warehouseId: { tenantId, productId, warehouseId } }
  });
  assert(stock, "Stock introuvable");
  const afterQty = stock.quantity + delta;
  if (afterQty < 0) throw new Error("Stock insuffisant");
  await prisma.stock.update({ where: { id: stock.id }, data: { quantity: afterQty } });
  await prisma.inventoryMovement.create({
    data: { tenantId, productId, warehouseId, type, quantity, beforeQty: stock.quantity, afterQty, reference, note, reason: note, userId, storeId }
  });
  return afterQty;
}

async function createSale({ tenantId, productId, warehouseId, storeId, userId, quantity, paidAmount }) {
  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId, warehouseId } } });
    assert(stock, "Stock introuvable");
    if (stock.quantity < quantity) throw new Error("Stock insuffisant");
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    const unitPrice = Number(product.salePrice);
    const total = unitPrice * quantity;
    const sale = await tx.sale.create({
      data: {
        tenantId,
        storeId,
        subtotal: total,
        total,
        status: SaleStatus.COMPLETED,
        items: { create: [{ productId, quantity, unitPrice, total }] }
      }
    });
    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        documentNumber: `INV-SMOKE-${Date.now()}`,
        status: paidAmount >= total ? SalesDocumentStatus.PAID : SalesDocumentStatus.PARTIALLY_PAID,
        subtotal: total,
        total,
        paidAmount,
        balance: Math.max(0, total - paidAmount),
        items: { create: [{ productId, quantity, unitPrice, total }] }
      }
    });
    if (paidAmount > 0) {
      await tx.payment.create({ data: { saleId: sale.id, invoiceId: invoice.id, method: PaymentMethod.CASH, amount: paidAmount } });
    }
    const afterQty = stock.quantity - quantity;
    await tx.stock.update({ where: { id: stock.id }, data: { quantity: afterQty } });
    await tx.inventoryMovement.create({
      data: { tenantId, productId, warehouseId, type: InventoryMovementType.SALE, quantity, beforeQty: stock.quantity, afterQty, reference: sale.id, note: "Smoke vente", reason: "Smoke vente", userId, storeId }
    });
    return { sale, invoice, change: Math.max(0, paidAmount - total), balance: Math.max(0, total - paidAmount) };
  });
}

async function main() {
  const suffix = Date.now().toString(36);
  const slug = `core-logic-smoke-${suffix}`;
  const tenant = await prisma.tenant.create({ data: { name: "Core Logic Smoke", slug, status: "TRIAL" } });
  try {
    const user = await prisma.user.create({ data: { tenantId: tenant.id, email: `${slug}@test.local`, name: "Smoke User", password: "test" } });
    const store = await prisma.store.create({ data: { tenantId: tenant.id, code: "SMOKE", name: "Magasin smoke" } });
    const warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, storeId: store.id, code: "SMOKE", name: "Depot smoke" } });
    const product = await prisma.product.create({
      data: { tenantId: tenant.id, sku: `SMOKE-${suffix}`, name: "Produit smoke", purchasePrice: 10, salePrice: 20, minimumStock: 2 }
    });
    await prisma.stock.create({ data: { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, quantity: 5, minimumStock: 2 } });

    assert(await getStock(tenant.id, product.id, warehouse.id) === 5, "Stock initial invalide");
    const afterPurchase = await moveStock({ tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, type: InventoryMovementType.PURCHASE, quantity: 2, delta: 2, reference: "SMOKE-PURCHASE", note: "Smoke achat", userId: user.id, storeId: store.id });
    assert(afterPurchase === 7, "Achat +2 doit donner stock 7");

    const exactSale = await createSale({ tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, storeId: store.id, userId: user.id, quantity: 3, paidAmount: 60 });
    assert(await getStock(tenant.id, product.id, warehouse.id) === 4, "Vente 3 depuis 7 doit donner stock 4");
    assert(exactSale.change === 0 && exactSale.balance === 0, "Paiement exact invalide");

    const overpaidSale = await createSale({ tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, storeId: store.id, userId: user.id, quantity: 1, paidAmount: 25 });
    assert(overpaidSale.change === 5, "Monnaie invalide sur paiement superieur");

    const partialSale = await createSale({ tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, storeId: store.id, userId: user.id, quantity: 1, paidAmount: 5 });
    assert(partialSale.balance === 15, "Balance invalide sur paiement partiel");

    let insufficientBlocked = false;
    try {
      await createSale({ tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, storeId: store.id, userId: user.id, quantity: 10, paidAmount: 200 });
    } catch (error) {
      insufficientBlocked = String(error.message).includes("Stock insuffisant");
    }
    assert(insufficientBlocked, "Stock insuffisant non bloque");

    const returnAfter = await moveStock({ tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, type: InventoryMovementType.RETURN, quantity: 1, delta: 1, reference: partialSale.sale.id, note: "Smoke retour", userId: user.id, storeId: store.id });
    assert(returnAfter === 3, "Retour 1 doit augmenter le stock");

    const cancelAfter = await moveStock({ tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, type: InventoryMovementType.CANCEL_SALE, quantity: 1, delta: 1, reference: overpaidSale.sale.id, note: "Smoke annulation", userId: user.id, storeId: store.id });
    assert(cancelAfter === 4, "Annulation vente doit restaurer le stock");

    const movementTypes = await prisma.inventoryMovement.findMany({ where: { tenantId: tenant.id }, select: { type: true } });
    const types = new Set(movementTypes.map((movement) => movement.type));
    for (const type of [InventoryMovementType.PURCHASE, InventoryMovementType.SALE, InventoryMovementType.RETURN, InventoryMovementType.CANCEL_SALE]) {
      assert(types.has(type), `Mouvement ${type} manquant`);
    }

    const salesTotal = await prisma.sale.aggregate({ where: { tenantId: tenant.id }, _sum: { total: true } });
    assert(Number(salesTotal._sum.total ?? 0) > 0, "Rapports ventes sans donnees");
    console.log("CORE_LOGIC_SMOKE_OK stock=4 purchase=ok sale=ok partial=ok overpaid=ok insufficient=ok return=ok cancel=ok reports=ok");
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error("CORE_LOGIC_SMOKE_FAILED", error.message);
  await prisma.$disconnect();
  process.exit(1);
});

// Verifie, contre une vraie base Postgres avec les VRAIS services compiles (apps/api/dist), le flux
// Devis -> Commande -> Avance -> Solde -> statuts pour la V1 Fabrication fenetres/portes :
// - titre + date prevue + notes de mesure (customNote) survivent devis -> conversion en commande
// - le stock n'est deduit qu'une seule fois, a la conversion (pas a la creation du devis)
// - l'echelle de statuts CONFIRMED -> IN_PROGRESS -> READY -> DELIVERED fonctionne en avant seulement
// - CANCELLED reste possible et restocke ; COMPLETED reste exclusivement pilote par le paiement complet
// - un paiement partiel puis complet met a jour paidAmount/balance/paymentStatus correctement (atomique,
//   deja teste par ailleurs ce soir, on verifie juste que le nouveau titre/expectedDate ne casse rien)

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://vta:vta_password@localhost:5432/vta_commerce?schema=public";
}

const path = require("path");
const distApi = path.join(__dirname, "..", "apps", "api", "dist");

const { PrismaService } = require(path.join(distApi, "prisma", "prisma.service.js"));
const { QuotesService } = require(path.join(distApi, "sales", "quotes.service.js"));
const { ProformasService } = require(path.join(distApi, "sales", "proformas.service.js"));

function assert(condition, message) {
  if (!condition) throw new Error("FAIL: " + message);
}

async function main() {
  const prisma = new PrismaService();
  const quotes = new QuotesService(prisma);
  const proformas = new ProformasService(prisma);
  const suffix = Date.now().toString(36);

  const tenant = await prisma.tenant.create({ data: { name: "Fabrication Quote Smoke", slug: `fab-quote-smoke-${suffix}`, status: "TRIAL" } });
  try {
    const store = await prisma.store.create({ data: { tenantId: tenant.id, code: "S1", name: "Atelier" } });
    const warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, storeId: store.id, code: "W1", name: "Depot", isActive: true } });
    const customer = await prisma.customer.create({ data: { tenantId: tenant.id, customerCode: `C1-${suffix}`, displayName: "Client Fabrication", customerType: "INDIVIDUAL" } });
    const glass = await prisma.product.create({ data: { tenantId: tenant.id, sku: `GLASS-${suffix}`, name: "Vitrage 6mm", purchasePrice: 100, salePrice: 200, minimumStock: 0 } });
    await prisma.stock.create({ data: { tenantId: tenant.id, productId: glass.id, warehouseId: warehouse.id, quantity: 10, minimumStock: 0 } });

    // --- Devis avec titre, date prevue, ligne personnalisee avec notes de mesure ---
    const expectedDate = new Date(Date.now() + 14 * 86400000).toISOString();
    const quote = await quotes.create(tenant.id, {
      customerId: customer.id,
      title: "Fenêtres salon + porte cuisine",
      expectedDate,
      items: [
        { productId: glass.id, quantity: 2, unitPrice: 200 },
        { customName: "Fenêtre coulissante", customType: "SERVICE", customNote: "Fenêtre · Aluminium · 120x90cm · Blanc · Verre 6mm", quantity: 1, unitPrice: 500 }
      ]
    });
    assert(quote.title === "Fenêtres salon + porte cuisine", "le titre doit etre persiste sur le devis");
    assert(quote.expectedDate, "la date prevue doit etre persistee sur le devis");
    assert(quote.items.some((item) => item.customNote?.includes("Aluminium")), "la note de mesure doit etre persistee sur la ligne personnalisee");

    const stockBefore = await prisma.stock.findFirst({ where: { tenantId: tenant.id, productId: glass.id } });
    assert(stockBefore.quantity === 10, "un devis ne doit jamais toucher le stock");

    // --- Conversion en commande : titre/date/notes de mesure doivent survivre, stock deduit une fois ---
    const order = await quotes.convertToProforma(tenant.id, quote.id, { warehouseId: warehouse.id }, undefined);
    assert(order.title === "Fenêtres salon + porte cuisine", "le titre doit survivre a la conversion devis -> commande");
    assert(order.expectedDate, "la date prevue doit survivre a la conversion");
    assert(order.items.some((item) => item.customNote?.includes("Aluminium")), "la note de mesure doit survivre a la conversion");
    assert(order.status === "CONFIRMED", `la commande doit demarrer CONFIRMED, recu ${order.status}`);

    const stockAfterConversion = await prisma.stock.findFirst({ where: { tenantId: tenant.id, productId: glass.id } });
    assert(stockAfterConversion.quantity === 8, `le stock doit etre deduit une seule fois (2 vitrages), recu ${stockAfterConversion.quantity}`);
    console.log("SCENARIO 1 OK : titre, date prevue et notes de mesure survivent devis -> commande, stock deduit une seule fois");

    // --- Echelle de statuts : CONFIRMED -> IN_PROGRESS -> READY -> DELIVERED, en avant seulement ---
    const inProgress = await proformas.updateStatus(tenant.id, order.id, "IN_PROGRESS");
    assert(inProgress.status === "IN_PROGRESS", "transition CONFIRMED -> IN_PROGRESS doit fonctionner");

    let regressionRejected = false;
    try {
      await proformas.updateStatus(tenant.id, order.id, "CONFIRMED");
    } catch (error) {
      regressionRejected = true;
    }
    assert(regressionRejected, "il ne doit pas etre possible de revenir en arriere (IN_PROGRESS -> CONFIRMED)");

    const ready = await proformas.updateStatus(tenant.id, order.id, "READY");
    assert(ready.status === "READY", "transition IN_PROGRESS -> READY doit fonctionner");

    const delivered = await proformas.updateStatus(tenant.id, order.id, "DELIVERED");
    assert(delivered.status === "DELIVERED", "transition READY -> DELIVERED doit fonctionner");
    assert(delivered.deliveredAt, "deliveredAt doit etre renseigne au passage a DELIVERED");

    let manualCompleteRejected = false;
    try {
      await proformas.updateStatus(tenant.id, order.id, "COMPLETED");
    } catch (error) {
      manualCompleteRejected = true;
    }
    assert(manualCompleteRejected, "COMPLETED ne doit jamais etre atteignable manuellement, seulement par paiement complet");

    const stockAfterStatusChanges = await prisma.stock.findFirst({ where: { tenantId: tenant.id, productId: glass.id } });
    assert(stockAfterStatusChanges.quantity === 8, "les transitions de statut en avant ne doivent jamais toucher le stock");
    console.log("SCENARIO 2 OK : echelle de statuts en avant seulement, COMPLETED reste exclusivement pilote par le paiement, stock jamais retouche");

    // --- Avance puis solde ---
    const total = Number(delivered.total);
    const depositAmount = Math.round(total / 3);
    const afterDeposit = await proformas.registerPayment(tenant.id, order.id, { method: "CASH", amount: depositAmount });
    assert(afterDeposit.paymentStatus === "PARTIALLY_PAID", "apres une avance partielle, paymentStatus doit etre PARTIALLY_PAID");
    assert(Number(afterDeposit.paidAmount) === depositAmount, "paidAmount doit correspondre a l'avance versee");
    assert(afterDeposit.status === "DELIVERED", "un paiement partiel ne doit pas changer le statut de livraison");

    const remainingBalance = Number(afterDeposit.balance);
    const afterFinal = await proformas.registerPayment(tenant.id, order.id, { method: "CASH", amount: remainingBalance });
    assert(afterFinal.paymentStatus === "PAID", "apres le solde complet, paymentStatus doit etre PAID");
    assert(afterFinal.status === "COMPLETED", "apres le solde complet, status doit passer automatiquement a COMPLETED");
    assert(Number(afterFinal.balance) === 0, "la balance doit etre a 0 apres le solde complet");
    console.log("SCENARIO 3 OK : avance partielle puis solde complet -> PARTIALLY_PAID puis PAID/COMPLETED automatique");

    // --- CANCELLED depuis un autre tenant/commande : doit rester possible et restocker ---
    const cancelTarget = await proformas.create(tenant.id, { customerId: customer.id, items: [{ productId: glass.id, quantity: 1, unitPrice: 200 }] });
    const stockBeforeCancel = await prisma.stock.findFirst({ where: { tenantId: tenant.id, productId: glass.id } });
    await proformas.updateStatus(tenant.id, cancelTarget.id, "CANCELLED");
    const stockAfterCancel = await prisma.stock.findFirst({ where: { tenantId: tenant.id, productId: glass.id } });
    assert(stockAfterCancel.quantity === stockBeforeCancel.quantity + 1, "CANCELLED doit toujours restocker la quantite deduite");
    console.log("SCENARIO 4 OK : CANCELLED reste disponible et restocke correctement");

    console.log("FABRICATION_QUOTE_ORDER_SMOKE_OK");
  } finally {
    await prisma.payment.deleteMany({ where: { proforma: { tenantId: tenant.id } } }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
    await prisma.proformaItem.deleteMany({ where: { proforma: { tenantId: tenant.id } } }).catch(() => {});
    await prisma.proforma.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
    await prisma.quoteItem.deleteMany({ where: { quote: { tenantId: tenant.id } } }).catch(() => {});
    await prisma.quote.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
    await prisma.stock.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
    await prisma.product.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
    await prisma.warehouse.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
    await prisma.store.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });

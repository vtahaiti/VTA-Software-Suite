// Verifie, contre une vraie base Postgres, que les correctifs de concurrence du 2026-07-24 tiennent :
// stock (survente du dernier article), paiement facture, paiement commande (double facture), retours
// (double retour). Contrairement aux autres scripts *-smoke.cjs de ce dossier (qui ne font que grep du
// code source), celui-ci importe et execute les VRAIS services compiles depuis apps/api/dist, donc une
// regression dans le code reel fera echouer ce script.
//
// Chaque scenario lance CONCURRENCY tentatives simultanees plutot que 2 : verifie empiriquement (en
// revenant temporairement au code d'avant correctif) que 2 tentatives concurrentes contre un Postgres
// local rapide ne suffisent PAS a declencher la race de facon fiable (les deux transactions ont trop
// peu de chances de se chevaucher), alors que 10+ la reproduisent systematiquement.
//
// Prerequis : `npm run build --workspace=@vta/api` (ou `cd apps/api && npm run build`) doit avoir ete
// execute recemment, et Postgres doit tourner sur DATABASE_URL (voir .env).

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://vta:vta_password@localhost:5432/vta_commerce?schema=public";
}

const path = require("path");
const distApi = path.join(__dirname, "..", "apps", "api", "dist");

const { PrismaService } = require(path.join(distApi, "prisma", "prisma.service.js"));
const { StockService } = require(path.join(distApi, "stock", "stock.service.js"));
const { SalesService } = require(path.join(distApi, "sales", "sales.service.js"));
const { InvoicesService } = require(path.join(distApi, "sales", "invoices.service.js"));
const { ProformasService } = require(path.join(distApi, "sales", "proformas.service.js"));
const { ReturnsService } = require(path.join(distApi, "sales", "returns.service.js"));
const { SalesDocumentStatus, SalesDocumentPaymentStatus } = require("@prisma/client");

const CONCURRENCY = 10;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runConcurrent(factories) {
  const results = await Promise.allSettled(factories.map((factory) => factory()));
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  return { fulfilled, rejected };
}

async function main() {
  const prisma = new PrismaService();
  const stock = new StockService(prisma);
  const sales = new SalesService(prisma, stock);
  const invoices = new InvoicesService(prisma);
  const proformas = new ProformasService(prisma);
  const returns = new ReturnsService(prisma, stock);

  const suffix = Date.now().toString(36);
  const slug = `concurrency-smoke-${suffix}`;
  const tenant = await prisma.tenant.create({ data: { name: "Concurrency Smoke", slug, status: "TRIAL" } });

  try {
    const user = await prisma.user.create({ data: { tenantId: tenant.id, email: `${slug}@test.local`, name: "Smoke User", password: "test" } });
    const store = await prisma.store.create({ data: { tenantId: tenant.id, code: "SMOKE", name: "Magasin smoke" } });
    const warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, storeId: store.id, code: "SMOKE", name: "Depot smoke", isActive: true } });
    const product = await prisma.product.create({ data: { tenantId: tenant.id, sku: `SMOKE-${suffix}`, name: "Produit smoke", purchasePrice: 10, salePrice: 20, minimumStock: 0 } });

    // --- Scenario 1 : survente du dernier article (SalesService.create) ---------------------------
    await prisma.stock.create({ data: { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, quantity: 1, minimumStock: 0 } });
    const saleDto = { items: [{ productId: product.id, quantity: 1 }], warehouseId: warehouse.id, storeId: store.id, payments: [{ method: "CASH", amount: 20 }] };
    const saleOutcome = await runConcurrent(Array.from({ length: CONCURRENCY }, () => () => sales.create(tenant.id, saleDto, user.id)));
    assert(saleOutcome.fulfilled.length === 1, `Vente concurrente (${CONCURRENCY}x) : attendu 1 succes, obtenu ${saleOutcome.fulfilled.length}`);
    assert(saleOutcome.rejected.length === CONCURRENCY - 1, `Vente concurrente : attendu ${CONCURRENCY - 1} echecs, obtenu ${saleOutcome.rejected.length}`);
    assert(saleOutcome.rejected.every((r) => String(r.reason?.message ?? "").includes("Stock insuffisant")), "Tous les rejets doivent etre 'Stock insuffisant'");
    const stockAfterSale = await prisma.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id } } });
    assert(stockAfterSale.quantity === 0, `Stock final attendu 0, obtenu ${stockAfterSale.quantity}`);
    console.log(`scenario 1/4 OK : survente du dernier article bloquee sur ${CONCURRENCY} tentatives simultanees (une seule vente passe)`);

    // --- Scenario 2 : double paiement facture (InvoicesService.registerPayment) -------------------
    const invoice = await prisma.invoice.create({
      data: { tenantId: tenant.id, documentNumber: `INV-SMOKE-${suffix}`, status: SalesDocumentStatus.SENT, subtotal: 100, total: 100, paidAmount: 0, balance: 100 }
    });
    const paymentOutcome = await runConcurrent(Array.from({ length: CONCURRENCY }, () => () => invoices.registerPayment(tenant.id, invoice.id, { amount: 100, method: "CASH" })));
    assert(paymentOutcome.fulfilled.length === 1, `Paiement facture concurrent (${CONCURRENCY}x) : attendu 1 succes, obtenu ${paymentOutcome.fulfilled.length}`);
    const invoiceAfter = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert(Number(invoiceAfter.balance) === 0, `Solde facture final attendu 0, obtenu ${invoiceAfter.balance}`);
    assert(invoiceAfter.status === SalesDocumentStatus.PAID, `Statut facture attendu PAID, obtenu ${invoiceAfter.status}`);
    const invoicePayments = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    assert(invoicePayments === 1, `Un seul paiement attendu sur la facture, obtenu ${invoicePayments}`);
    console.log(`scenario 2/4 OK : double paiement facture bloque sur ${CONCURRENCY} tentatives simultanees (un seul paiement enregistre)`);

    // --- Scenario 3 : double generation de facture depuis une commande (ProformasService.registerPayment) ---
    const proforma = await prisma.proforma.create({
      data: {
        tenantId: tenant.id,
        documentNumber: `CMD-SMOKE-${suffix}`,
        status: SalesDocumentStatus.CONFIRMED,
        paymentStatus: SalesDocumentPaymentStatus.UNPAID,
        subtotal: 100,
        total: 100,
        paidAmount: 0,
        balance: 100,
        items: { create: [{ productId: product.id, quantity: 1, unitPrice: 100, total: 100 }] }
      }
    });
    const proformaOutcome = await runConcurrent(Array.from({ length: CONCURRENCY }, () => () => proformas.registerPayment(tenant.id, proforma.id, { amount: 100, method: "CASH" }, user.id)));
    assert(proformaOutcome.fulfilled.length === 1, `Paiement commande concurrent (${CONCURRENCY}x) : attendu 1 succes, obtenu ${proformaOutcome.fulfilled.length}`);
    const generatedInvoices = await prisma.invoice.count({ where: { proformaId: proforma.id } });
    assert(generatedInvoices === 1, `Une seule facture attendue pour la commande, obtenu ${generatedInvoices}`);
    console.log(`scenario 3/4 OK : double generation de facture bloquee sur ${CONCURRENCY} tentatives simultanees (une seule facture creee)`);

    // --- Scenario 4 : double retour sur la meme ligne de facture (ReturnsService.create) ----------
    const returnInvoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        documentNumber: `INV-RET-SMOKE-${suffix}`,
        status: SalesDocumentStatus.PAID,
        subtotal: 40,
        total: 40,
        paidAmount: 40,
        balance: 0,
        items: { create: [{ productId: product.id, quantity: 2, unitPrice: 20, total: 40 }] }
      },
      include: { items: true }
    });
    const returnInvoiceItem = returnInvoice.items[0];
    const returnDto = { invoiceId: returnInvoice.id, warehouseId: warehouse.id, items: [{ invoiceItemId: returnInvoiceItem.id, quantity: 2 }] };
    const returnOutcome = await runConcurrent(Array.from({ length: CONCURRENCY }, () => () => returns.create(tenant.id, returnDto, user.id)));
    assert(returnOutcome.fulfilled.length === 1, `Retour concurrent (${CONCURRENCY}x) : attendu 1 succes, obtenu ${returnOutcome.fulfilled.length}`);
    assert(returnOutcome.rejected.every((r) => String(r.reason?.message ?? "").includes("Quantité retournée invalide")), "Tous les rejets doivent etre 'Quantité retournée invalide'");
    const totalReturned = await prisma.salesReturnItem.aggregate({ where: { invoiceItemId: returnInvoiceItem.id }, _sum: { quantity: true } });
    assert(Number(totalReturned._sum.quantity ?? 0) === 2, `Quantite totale retournee attendue 2, obtenu ${totalReturned._sum.quantity}`);
    console.log(`scenario 4/4 OK : double retour bloque sur ${CONCURRENCY} tentatives simultanees (quantite totale retournee correcte)`);

    console.log("CONCURRENCY_ATOMICITY_SMOKE_OK");
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error("CONCURRENCY_ATOMICITY_SMOKE_FAILED", error.message);
  process.exit(1);
});

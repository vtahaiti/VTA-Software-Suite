const assert = require("node:assert/strict");
const XLSX = require("xlsx");

const { PurchaseOrdersService } = require("../apps/api/dist/purchases/purchase-orders.service.js");
const { SuppliersService } = require("../apps/api/dist/suppliers/suppliers.service.js");
const { InventoryService } = require("../apps/api/dist/inventory/inventory.service.js");

function assertXlsx(buffer, expectedSheet) {
  assert(Buffer.isBuffer(buffer), "XLSX export must return a Buffer");
  assert.equal(buffer.subarray(0, 2).toString("utf8"), "PK", "XLSX must be a ZIP container");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  assert(workbook.SheetNames.includes(expectedSheet), `Missing sheet ${expectedSheet}`);
  const sheet = workbook.Sheets[expectedSheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true });
  assert(rows.length >= 1, "XLSX must contain at least one data row or empty-state row");
  const xmlText = buffer.toString("utf8", 0, Math.min(buffer.length, 500));
  assert(!xmlText.includes("<table"), "XLSX must not be HTML");
  assert(!xmlText.includes("{\""), "XLSX must not be JSON");
  return rows;
}

function assertCsv(csv) {
  assert.equal(csv.charCodeAt(0), 0xfeff, "CSV must start with UTF-8 BOM");
  assert(csv.includes(";"), "CSV must use semicolon separators for Excel compatibility");
  assert(csv.includes("'=FORMULE"), "CSV formula values must be neutralized");
  assert(!csv.includes("<table"), "CSV must not contain HTML");
}

async function main() {
  const now = new Date("2026-07-13T16:30:00.000Z");

  const purchaseService = new PurchaseOrdersService({
    purchaseOrder: {
      findMany: async () => [{
        number: "PO-TEST",
        supplier: { name: "=FORMULE" },
        status: "APPROVED",
        subtotal: 1000,
        discount: 0,
        tax: 0,
        total: 1000,
        createdAt: now
      }]
    }
  });
  assertCsv(await purchaseService.exportCsv("tenant_test"));
  const purchaseRows = assertXlsx(await purchaseService.exportExcel("tenant_test"), "achats");
  assert.equal(purchaseRows[0]["Numéro"], "PO-TEST");
  assert.equal(typeof purchaseRows[0].Total, "number");

  const suppliersService = new SuppliersService({
    supplier: {
      findMany: async () => [{
        code: "SUP-001",
        name: "=FORMULE",
        company: "Société Éclair",
        phone: "+509 0000-0000",
        whatsapp: "",
        email: "test@example.com",
        city: "Port-au-Prince",
        country: "Haïti",
        primaryContact: "René",
        currency: "HTG",
        status: "ACTIVE"
      }]
    }
  });
  assertCsv(await suppliersService.exportCsv("tenant_test"));
  const supplierRows = assertXlsx(await suppliersService.exportExcel("tenant_test"), "fournisseurs");
  assert.equal(supplierRows[0]["Société"], "Société Éclair");

  const inventoryService = new InventoryService({
    inventoryMovement: {
      findMany: async () => [{
        createdAt: now,
        type: "IN",
        product: { name: "=FORMULE" },
        warehouse: { name: "Dépôt principal" },
        quantity: 5,
        beforeQty: 1,
        afterQty: 6,
        note: "Entrée HTG",
        reason: null
      }],
      count: async () => 1
    }
  }, {});
  assertCsv(await inventoryService.exportCsv("tenant_test"));
  const inventoryRows = assertXlsx(await inventoryService.exportExcel("tenant_test"), "inventaire");
  assert.equal(inventoryRows[0]["Dépôt"], "Dépôt principal");
  assert.equal(typeof inventoryRows[0]["Quantité"], "number");

  console.log("Export runtime smoke OK");
}

main().catch((error) => {
  console.error("EXPORT_RUNTIME_SMOKE_FAILED", error);
  process.exit(1);
});

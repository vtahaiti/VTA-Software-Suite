const fs = require("fs");
const path = require("path");

const root = process.cwd();
const salesService = fs.readFileSync(path.join(root, "apps/api/src/sales/sales.service.ts"), "utf8");
const printService = fs.readFileSync(path.join(root, "apps/api/src/print/invoice-print.service.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "database/prisma/schema.prisma"), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(schema.includes("model Receipt"), "Receipt model must exist.");
assert(!schema.includes("model ReceiptCounter"), "This implementation must not require a new ReceiptCounter migration.");
assert(salesService.includes("nextReceiptNumber(tx, tenantId)"), "Finalized POS sales must request a tenant receipt number inside the transaction.");
assert(salesService.includes("pg_advisory_xact_lock"), "Receipt numbering must use a transaction-scoped tenant lock for concurrent cashiers on PostgreSQL.");
assert(salesService.includes('String(count + 1).padStart(5, "0")'), "Receipt number must use 00001-style padding.");
assert(salesService.includes("number: receiptNumber"), "Receipt.number must store the generated tenant-scoped receipt number.");
assert(!salesService.includes('number: this.documentNumber("RCT")'), "POS receipts must not use timestamp RCT numbers anymore.");
assert(printService.includes("displayReceiptNumber(tenantId"), "Printed tickets must hide the internal tenant prefix.");
assert(printService.includes("<span class=\"label\">Ticket</span><strong class=\"amount\">#"), "Printed tickets must display a simple #00001-style label.");

console.log("receipt-numbering smoke: ok");

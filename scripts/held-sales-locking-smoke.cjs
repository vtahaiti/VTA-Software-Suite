const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertContains(file, text, message) {
  const source = read(file);
  if (!source.includes(text)) throw new Error(message + ": " + text);
}

function assertRegex(file, pattern, message) {
  const source = read(file);
  if (!pattern.test(source)) throw new Error(message);
}

const apiService = "apps/api/src/pos/pos.service.ts";
const apiController = "apps/api/src/pos/pos.controller.ts";
const webSales = "apps/web/app/dashboard/sales/sales-status-page.tsx";
const webPos = "apps/web/app/dashboard/pos/page.tsx";
const schema = "database/prisma/schema.prisma";

assertContains(schema, "enum HeldSaleStatus", "HeldSaleStatus enum missing");
assertContains(schema, "claimedBySessionId", "HeldSale session lock field missing");
assertContains(schema, "finalizeIdempotencyKey", "HeldSale idempotency field missing");
assertContains(schema, "@@index([tenantId, status, claimExpiresAt])", "HeldSale status lock index missing");

assertContains(apiController, "@Post(\"held-sales/:id/claim\")", "Claim endpoint missing");
assertContains(apiController, "@Post(\"held-sales/:id/release\")", "Release endpoint missing");
assertContains(apiController, "@Post(\"held-sales/:id/finalize\")", "Finalize endpoint missing");
assertContains(apiController, "req.user.sessionId", "Held sale endpoints must use authenticated session id");

assertContains(apiService, "updateMany", "Atomic claim/finalize updates must use conditional updateMany");
assertContains(apiService, "Cette vente est deja reprise par un autre caissier.", "Concurrent claim conflict message missing");
assertContains(apiService, "status: \"FINALIZING\"", "Finalize status transition missing");
assertContains(apiService, "finalizeIdempotencyKey", "Finalize idempotency key missing in service");
assertContains(apiService, "this.sales.create", "Finalize must reuse existing sale creation logic");
assertContains(apiService, "catch (error)", "Finalize rollback path missing");

assertContains(webSales, "/claim", "In-progress page must claim before resume");
assertContains(webSales, "Annuler cette vente en attente ?", "Accessible cancel confirmation missing");
assertContains(webSales, "autre caissier", "Locked-by-other status label missing");
assertContains(webSales, "disabled={lockedByOther", "Locked drafts must disable actions");

assertContains(webPos, "/finalize", "POS must finalize resumed held sales through finalize endpoint");
assertContains(webPos, "heldSaleFinalizeKey", "POS idempotency key must persist with draft");
assertContains(webPos, "body: JSON.stringify(heldSaleId ? { sale: payload, idempotencyKey: finalizeKey } : payload)", "POS must leave normal checkout payload unchanged");

console.log("held-sales-locking contract smoke: OK");

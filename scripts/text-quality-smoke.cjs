const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const files = [
  "apps/web/app/dashboard/page.tsx",
  "apps/web/app/dashboard/sales/sales-status-page.tsx",
  "apps/web/app/dashboard/purchases/receipts/page.tsx",
  "apps/web/app/dashboard/settings/invoicing/page.tsx",
  "apps/web/app/dashboard/profile/page.tsx",
  "apps/web/app/dashboard/customers/page.tsx",
  "apps/api/src/print/invoice-print.service.ts"
];
const forbidden = ["\u00c3", "\u00c2", "\ufffd", "co?t", "estim?e", "B?n", "r\u00c3", "d\u00c3", "pr\u00c3", "t\u00c3"];
const failures = [];
for (const file of files) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  for (const pattern of forbidden) {
    if (content.includes(pattern)) failures.push(file + ": motif corrompu " + JSON.stringify(pattern) + " trouve");
  }
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log("Text quality smoke tests OK");

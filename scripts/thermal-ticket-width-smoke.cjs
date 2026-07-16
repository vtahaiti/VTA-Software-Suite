const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const apiPrint = read("apps/api/src/print/invoice-print.service.ts");
const apiDto = read("apps/api/src/settings/dto/settings.dto.ts");
const webPrintPage = read("apps/web/app/dashboard/pos/print/page.tsx");
const webPrint = read("apps/web/lib/print.ts");
const invoicingPage = read("apps/web/app/dashboard/settings/invoicing/page.tsx");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(apiDto.includes('@IsIn(["58", "72", "80"])'), "API settings must accept 72mm receipt format.");
assert(apiPrint.includes('type ReceiptWidth = "58" | "72" | "80"'), "API receipt width must include 72.");
assert(apiPrint.includes("contentWidthMm: 72"), "API ticket must cap 72/80 printable content at 72mm.");
assert(apiPrint.includes('pageWidthMm: width === "80" ? 80 : 72'), "API 80mm mode must keep 80mm paper while using 72mm printable width.");
assert(webPrint.includes('type ReceiptWidth = "58" | "72" | "80"'), "Web print helper must include 72.");
assert(webPrintPage.includes('value === "58" || value === "72" || value === "80"'), "Print preview must parse 72mm width.");
assert(webPrintPage.includes("contentWidthMm: 72"), "Print preview must cap POS80 printable content at 72mm.");
assert(invoicingPage.includes('value="72"'), "Invoicing settings must expose 72mm POS80 option.");
assert(invoicingPage.includes("PaperSize 72.00 x 3276.00 mm"), "Invoicing settings must explain POS80 Windows PaperSize.");

console.log("thermal-ticket-width smoke: ok");

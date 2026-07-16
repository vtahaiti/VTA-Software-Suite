const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const uploadsController = read("apps/api/src/uploads/uploads.controller.ts");
const settingsDto = read("apps/api/src/settings/dto/settings.dto.ts");
const companySettings = read("apps/web/app/dashboard/settings/company/page.tsx");
const brandingHelper = read("apps/web/lib/company-branding.ts");
const printService = read("apps/api/src/print/invoice-print.service.ts");
const webPrintPage = read("apps/web/app/dashboard/pos/print/page.tsx");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(uploadsController.includes('FileInterceptor("file"'), "Company logo upload must accept a file field.");
assert(uploadsController.includes("Le logo entreprise doit etre envoye comme fichier"), "Company logo upload must reject Base64 payloads.");
assert(settingsDto.includes("@Matches(/^(?!data:).*/i"), "Settings PATCH must reject Base64 logoUrl values.");
assert(companySettings.includes("FormData") && companySettings.includes('body.append("file"'), "Company settings must upload logo as a file.");
assert(companySettings.includes("vta:branding-updated"), "Company settings must refresh shared branding after save.");
assert(brandingHelper.includes('cache: "no-store"'), "Branding helper must bypass stale browser cache.");
assert(printService.includes("absoluteAssetUrl"), "Print service must convert relative logo paths to absolute URLs.");
assert(printService.includes('onerror="this.remove()"'), "Printed documents must continue if the logo image fails.");
assert(webPrintPage.includes("waitForPrintableDocument"), "Print preview must wait for images/fonts before printing.");

console.log("company-logo-branding smoke: ok");

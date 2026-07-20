const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const uploadsController = read("apps/api/src/uploads/uploads.controller.ts");
const settingsDto = read("apps/api/src/settings/dto/settings.dto.ts");
const companySettings = read("apps/web/app/dashboard/settings/company/page.tsx");
const onboardingCompany = read("apps/web/app/onboarding/company/page.tsx");
const brandingHelper = read("apps/web/lib/company-branding.ts");
const printService = read("apps/api/src/print/invoice-print.service.ts");
const webPrintPage = read("apps/web/app/dashboard/pos/print/page.tsx");
const salesDocumentPage = read("apps/web/app/dashboard/sales/sales-document-page.tsx");
const salesDocumentDetailPage = read("apps/web/app/dashboard/sales/sales-document-detail-page.tsx");
const onboardingDto = read("apps/api/src/onboarding/dto/create-company.dto.ts");
const onboardingService = read("apps/api/src/onboarding/onboarding.service.ts");
const businessModulesPage = read("apps/web/app/dashboard/settings/business-modules/page.tsx");
const businessProfilesService = read("apps/api/src/business-profiles/business-profiles.service.ts");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(uploadsController.includes('FileInterceptor("file"'), "Company logo upload must accept a file field.");
assert(uploadsController.includes("Le logo entreprise doit etre envoye comme fichier"), "Company logo upload must reject Base64 payloads.");
assert(uploadsController.includes("pendingToken"), "Onboarding logo upload must be tied to a pending registration token.");
assert(settingsDto.includes("@Matches(/^(?!data:).*/i"), "Settings PATCH must reject Base64 logoUrl values.");
assert(companySettings.includes("FormData") && companySettings.includes('body.append("file"'), "Company settings must upload logo as a file.");
assert(companySettings.includes("vta:branding-updated"), "Company settings must refresh shared branding after save.");
assert(onboardingCompany.includes("FormData") && onboardingCompany.includes('body.append("file"'), "Onboarding must upload logo as multipart file.");
assert(onboardingCompany.includes('body.append("pendingToken"'), "Onboarding logo upload must send the pending token.");
assert(!onboardingCompany.includes("logoDataUrl"), "Onboarding must not send a Base64 logoDataUrl.");
assert(onboardingDto.includes("logoUrl") && onboardingDto.includes("@Matches(/^(?!data:).*/i"), "Onboarding DTO must accept only a non-Base64 logoUrl.");
assert(!onboardingService.includes('saveDataUrl("tenants", dto.logoDataUrl)'), "Onboarding service must not persist company logo from Base64.");
assert(brandingHelper.includes('cache: "no-store"'), "Branding helper must bypass stale browser cache.");
assert(printService.includes("absoluteAssetUrl"), "Print service must convert relative logo paths to absolute URLs.");
assert(printService.includes('onerror="this.remove()"'), "Printed documents must continue if the logo image fails.");
assert(webPrintPage.includes("waitForPrintableDocument"), "Print preview must wait for images/fonts before printing.");
assert(salesDocumentPage.includes("getCompanyBranding") && salesDocumentPage.includes("PrintBrandHeader"), "Quotes/orders printable page must include company branding.");
assert(salesDocumentPage.includes("waitForPrintableImages"), "Quotes/orders list print must wait for logo images before printing.");
assert(salesDocumentDetailPage.includes("getCompanyBranding") && salesDocumentDetailPage.includes("PrintBrandHeader"), "Quotes/orders detail print must include company branding.");
assert(salesDocumentDetailPage.includes("waitForPrintableImages"), "Quotes/orders detail print must wait for logo images before printing.");
assert(businessModulesPage.includes("Changer l'activite modifiera les menus et fonctionnalites visibles, mais ne supprimera pas vos donnees."), "Business profile switch must warn before changing activity.");
assert(businessModulesPage.includes("window.confirm"), "Business profile switch must ask for confirmation.");
assert(businessProfilesService.includes("companyProfile.upsert") && businessProfilesService.includes("tenantSettings.upsert"), "Business profile switch must update tenant, settings and company profile.");

console.log("company-logo-branding smoke: ok");

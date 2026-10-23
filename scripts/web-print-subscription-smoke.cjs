const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const webPrint = read("apps/web/lib/print.ts");
assert(!webPrint.includes("window.open"), "Le helper Web d'impression ne doit plus utiliser window.open.");
assert(!webPrint.includes("Autorisez les pop-ups"), "Le message pop-up bloquee ne doit plus etre visible.");
assert(webPrint.includes("printHtmlInHiddenFrame"), "L'impression Web doit passer par une iframe controlee.");
assert(webPrint.includes("iframe.remove()"), "L'iframe d'impression doit etre nettoyee.");
assert(webPrint.includes("doc.fonts?.ready") && webPrint.includes("doc.images"), "L'impression doit attendre polices et images.");

const invoicePrint = read("apps/api/src/print/invoice-print.service.ts");
assert(!invoicePrint.includes('<div class="qr">'), "Les tickets imprimes ne doivent plus afficher de QR code.");
assert(!invoicePrint.includes(".qr {"), "Le style QR ne doit plus reserver d'espace.");
assert(invoicePrint.includes("Signature autorisée : ______________________________"), "La signature autorisee doit apparaitre sur les documents.");
assert(invoicePrint.includes('size: ${pageSize}; margin: ${format === "a4" ? "12mm" : "12.7mm"}'), "Les marges A4/Letter doivent etre explicites.");
assert(invoicePrint.includes('type ReceiptWidth = "58" | "72" | "80"'), "Les tickets doivent prendre en charge 58, 72 et 80 mm.");
assert(invoicePrint.includes("@page { size: ${widthConfig.pageWidthMm}mm auto; margin: 0; }"), "Le format thermique doit fixer la taille physique sans marge page.");
assert(invoicePrint.includes("html, body { width: ${widthConfig.pageWidthMm}mm; max-width: ${widthConfig.pageWidthMm}mm; margin: 0; padding: 0;"), "Le body du ticket ne doit pas depasser la largeur papier.");
assert(invoicePrint.includes(".ticket { width: 100%; max-width: ${widthConfig.contentWidthMm}mm; margin: 0 auto; padding: ${widthConfig.safePadding};"), "Le contenu et le padding doivent rester dans la largeur imprimable.");
assert(invoicePrint.includes('pageWidthMm: width === "80" ? 80 : 72') && invoicePrint.includes("contentWidthMm: 72"), "Le papier 80 mm doit respecter la largeur imprimable POS80 de 72 mm.");
assert(invoicePrint.includes('usefulWidth: "54mm"') && invoicePrint.includes('usefulWidth: "66mm"'), "Les largeurs utiles 58 et 72/80 mm doivent rester sûres.");
assert(invoicePrint.includes('amountWidth: "21mm"') && invoicePrint.includes('amountWidth: "24mm"'), "La colonne montant doit rester bornee pour eviter les coupures.");
assert(invoicePrint.includes("Reste à payer"), "Le ticket doit afficher le reste a payer quand un solde existe.");
assert(invoicePrint.includes("grid-template-columns: minmax(0, 1fr) minmax(0, ${widthConfig.amountWidth})"), "Les lignes ticket doivent utiliser une grille reductible.");
assert(invoicePrint.includes("max-width: ${widthConfig.amountWidth}") && invoicePrint.includes("white-space: normal"), "Les montants longs doivent rester dans leur colonne.");
assert(invoicePrint.includes("font-weight: 600") && invoicePrint.includes("Consolas"), "Le ticket thermique Windows doit utiliser une police plus nette et lisible.");
assert(!invoicePrint.includes("body { width: ${widthConfig.usefulWidth}; margin: 0 auto; padding: ${widthConfig.safePadding};"), "Le ticket ne doit jamais cumuler largeur utile et padding sur body.");

for (const file of [
  "apps/api/src/inventory/inventory.controller.ts",
  "apps/api/src/suppliers/suppliers.controller.ts",
  "apps/api/src/purchases/purchase-orders.controller.ts"
]) {
  const source = read(file);
  assert(source.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), `${file} doit annoncer un vrai XLSX.`);
  assert(!source.includes("application/vnd.ms-excel"), `${file} ne doit plus annoncer un faux Excel HTML.`);
  assert(!/filename=[^"'\s;]+\.xls(["'\s;]|$)/i.test(source), `${file} ne doit plus proposer l'extension .xls.`);
}

const subscriptionPage = read("apps/web/app/dashboard/settings/subscription/page.tsx");
assert(subscriptionPage.includes("/subscription/plan-requests"), "La demande de plan doit passer par l'API de demande, pas par une activation directe.");
assert(subscriptionPage.includes("Demande en attente"), "L'entreprise doit voir clairement la demande de plan en attente.");

const subscriptionsController = read("apps/api/src/subscriptions/subscriptions.controller.ts");
assert(subscriptionsController.includes('@Post("plan-requests")'), "L'API tenant doit exposer une demande de plan sans activation immediate.");

const platformService = read("apps/api/src/platform/platform.service.ts");
assert(platformService.includes("PLAN_CHANGE_CONFIRMED"), "La confirmation Super Admin doit produire un evenement de confirmation.");
assert(platformService.includes("actorUserId") && platformService.includes("userId: actorUserId"), "La confirmation Super Admin doit tracer l'administrateur dans les evenements et l'audit.");
const platformController = read("apps/api/src/platform/platform.controller.ts");
assert(platformController.includes("PlatformAdminGuard"), "Les actions plateforme doivent rester protegees par le guard Super Admin.");
assert(platformController.includes("request.user.id"), "La confirmation Super Admin doit transmettre l'identifiant administrateur au service.");

console.log("Web print/subscription smoke OK");

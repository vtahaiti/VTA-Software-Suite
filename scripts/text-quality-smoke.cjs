const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const text = (value) => value;
const marker = (...codes) => String.fromCharCode(...codes);

const files = [
  "apps/web/app/dashboard/sales/page.tsx",
  "apps/web/app/dashboard/sales/sales-document-page.tsx",
  "apps/web/app/dashboard/sales/sales-document-detail-page.tsx",
  "apps/web/app/dashboard/purchases/page.tsx",
  "apps/web/app/dashboard/purchases/receipts/page.tsx",
  "apps/web/app/dashboard/reports/page.tsx",
  "apps/web/app/dashboard/users/page.tsx",
  "apps/web/app/dashboard/settings/subscription/page.tsx",
  "apps/web/app/dashboard/products/page.tsx",
  "apps/web/app/dashboard/settings/company/page.tsx",
  "apps/web/app/dashboard/import-export/page.tsx",
  "apps/web/app/onboarding/company/page.tsx",
  "apps/web/app/onboarding/welcome/page.tsx",
  "apps/web/app/offline/page.tsx",
  "apps/web/lib/business-profiles.ts",
  "apps/api/src/business-profiles/business-profiles.service.ts",
  "apps/api/src/business-profiles/business-catalog.ts",
  "apps/api/src/sales/sales.service.ts",
  "apps/api/src/roles/roles.service.ts",
  "apps/api/src/warehouses/warehouse.service.ts",
  "apps/api/src/cash-register/cash-register.service.ts",
  "apps/api/src/permissions/permissions.service.ts"
];

const forbidden = [
  marker(0xc3),
  marker(0xc2),
  marker(0xfffd),
  marker(0xf0, 0x178),
  marker(0xe2, 0x161),
  "Creer",
  "Creez",
  "Quantite",
  "personnalisee",
  "recents",
  "Numero",
  "Precedent",
  "Securite",
  "Parametres",
  "DONNEES",
  "Aucune reception",
  "Flux V1",
  "Règle V1",
  "Actions visibles",
  "volontairement simple",
  "données réelles",
  "Coût non renseigné"
];

const expected = new Map([
  ["apps/web/app/dashboard/sales/page.tsx", [text("Devis en attente"), text("Commandes pr\u00eates"), text("Avances re\u00e7ues")]],
  ["apps/web/app/dashboard/sales/sales-document-page.tsx", [text("Cr\u00e9er"), text("Quantit\u00e9"), text("personnalis\u00e9e")]],
  ["apps/web/app/dashboard/purchases/page.tsx", [text("R\u00e9ception"), text("Re\u00e7u"), text("d\u00e9penses g\u00e9n\u00e9rales restent s\u00e9par\u00e9es")]],
  ["apps/web/app/dashboard/reports/page.tsx", [text("Rapports")]],
  ["apps/web/app/dashboard/users/page.tsx", [text("r\u00f4le"), text("Cr\u00e9er utilisateur"), text("r\u00e9activez")]],
  ["apps/web/app/dashboard/settings/subscription/page.tsx", [text("Param\u00e8tres")]],
  ["apps/web/app/dashboard/products/page.tsx", [text("Co\u00fbt manquant")]],
  ["apps/web/app/dashboard/settings/company/page.tsx", [text("Param\u00e8tres"), text("Choisir un logo"), text("T\u00e9l\u00e9phone"), text("Num\u00e9ro fiscal")]],
  ["apps/web/app/dashboard/import-export/page.tsx", [text("Donn\u00e9es")]],
  ["apps/web/app/onboarding/company/page.tsx", [text("Ha\u00efti"), text("Cr\u00e9ez votre espace entreprise"), text("Sp\u00e9cialit\u00e9"), text("D\u00e9partement")]],
  ["apps/web/app/offline/page.tsx", [text("hors ligne")]],
  ["apps/web/lib/business-profiles.ts", [text("Accueil"), text("Param\u00e8tres")]],
  ["apps/api/src/business-profiles/business-profiles.service.ts", [text("Param\u00e8tres avanc\u00e9s"), text("Modules m\u00e9tier")]],
  ["apps/api/src/business-profiles/business-catalog.ts", [text("multi-activit\u00e9")]]
]);

const failures = [];
for (const file of files) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${file}: fichier introuvable`);
    continue;
  }
  const content = fs.readFileSync(fullPath, "utf8");
  for (const pattern of forbidden) {
    if (content.includes(pattern)) failures.push(`${file}: motif non corrig\u00e9 ${JSON.stringify(pattern)} trouv\u00e9`);
  }
  for (const value of expected.get(file) || []) {
    if (!content.includes(value)) failures.push(`${file}: texte attendu absent ${JSON.stringify(value)}`);
  }
}

assert.deepEqual(failures, [], failures.join("\n"));
console.log("Text quality smoke tests OK");

const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const files = [
  "apps/web/app/page.tsx",
  "apps/web/app/dashboard/page.tsx",
  "apps/web/app/dashboard/sales/sales-status-page.tsx",
  "apps/web/app/dashboard/reports/page.tsx",
  "apps/web/app/dashboard/purchases/page.tsx",
  "apps/web/app/dashboard/purchases/receipts/page.tsx",
  "apps/web/app/dashboard/products/page.tsx",
  "apps/web/app/dashboard/customers/page.tsx",
  "apps/web/app/dashboard/settings/company/page.tsx",
  "apps/web/app/dashboard/settings/pos/page.tsx",
  "apps/web/app/dashboard/settings/invoicing/page.tsx",
  "apps/web/app/dashboard/profile/page.tsx",
  "apps/web/app/dashboard/users/page.tsx",
  "apps/web/lib/business-profiles.ts",
  "apps/web/app/dashboard/audit-logs/page.tsx",
  "apps/web/app/dashboard/backups/page.tsx",
  "apps/web/app/dashboard/import-export/page.tsx",
  "apps/web/app/dashboard/settings/permissions/page.tsx",
  "apps/api/src/business-profiles/business-profiles.service.ts",
  "apps/api/src/business-profiles/business-catalog.ts",
  "apps/web/app/profile/page.tsx",
  "apps/web/components/header.tsx",
  "apps/web/lib/format.ts",
  "apps/web/app/onboarding/company/page.tsx",
  "apps/api/src/purchases/goods-receipts.service.ts",
  "apps/api/src/onboarding/onboarding.service.ts",
  "apps/api/src/pos/pos.service.ts",
  "apps/api/src/print/invoice-print.service.ts"
];

const forbidden = ["\u00c3", "\u00c2", "\ufffd", "\u00f0\u0178", "\u00e2\u0161", "associ?e", "T?l?phone", "R?le", "Param?", "D?p", "Ha?ti", "co?t", "estim?e", "B?n", "avanc?e", "affichees", "Depot principal", "Haiti", "Nouvelle activit?", "1 lignes", "Telephone principal", "Numero fiscal", "Historique des receptions", "Aucune reception"];
const expected = new Map([
  ["apps/web/app/dashboard/settings/company/page.tsx", ["Param\u00e8tres", "\u{1f4f7} Choisir un logo", "configur\u00e9", "affich\u00e9es", "T\u00e9l\u00e9phone", "Num\u00e9ro fiscal"]],
  ["apps/web/app/dashboard/profile/page.tsx", ["Entreprise associ\u00e9e", "T\u00e9l\u00e9phone", "R\u00f4le", "Propri\u00e9taire"]],
  ["apps/web/components/header.tsx", ["formatRole", "D\u00e9connexion"]],
  ["apps/web/app/profile/page.tsx", ["formatRole", "Date cr\u00e9ation", "pr\u00e9par\u00e9"]],
  ["apps/web/lib/format.ts", ["Propri\u00e9taire", "Super administrateur"]],
  ["apps/web/app/dashboard/customers/page.tsx", ["\u{1f464} Nom", "\u{1f4de} T\u00e9l\u00e9phone", "\u{1f3e2} Entreprise", "\u{1f4b0} Solde", "\u2699\ufe0f Actions", "label=\"client\""]],
  ["apps/web/app/onboarding/company/page.tsx", ["Ha\u00efti", "Activit\u00e9 principale"]],
  ["apps/api/src/onboarding/onboarding.service.ts", ["D\u00e9p\u00f4t principal", "Propri\u00e9taire"]],
  ["apps/api/src/pos/pos.service.ts", ["D\u00e9p\u00f4t principal"]],
  ["apps/web/app/dashboard/audit-logs/page.tsx", ["Historique des actions", "Recherche instantan\u00e9e", "Pr\u00e9c\u00e9dent", "Aucune action"]],
  ["apps/web/app/dashboard/backups/page.tsx", ["Sauvegardes", "sauvegardes pr\u00e9par\u00e9es", "fausse s\u00e9curit\u00e9"]],
  ["apps/web/app/dashboard/import-export/page.tsx", ["Donn\u00e9es", "Aper\u00e7u", "R\u00e9sultat", "Format accept\u00e9"]],
  ["apps/web/app/dashboard/settings/permissions/page.tsx", ["Param\u00e8tres avanc\u00e9s", "Permissions", "matrice"]],
  ["apps/web/lib/business-profiles.ts", ["\u{1f3e0} Accueil", "\u2699\ufe0f Param\u00e8tres"]],
  ["apps/api/src/business-profiles/business-profiles.service.ts", ["Param\u00e8tres avanc\u00e9s", "Audit", "Modules m\u00e9tier"]]
]);

const failures = [];
for (const file of files) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    failures.push(file + ": fichier introuvable");
    continue;
  }
  const content = fs.readFileSync(fullPath, "utf8");
  for (const pattern of forbidden) {
    if (content.includes(pattern)) failures.push(file + ": motif corrompu " + JSON.stringify(pattern) + " trouve");
  }
  for (const value of expected.get(file) || []) {
    if (!content.includes(value)) failures.push(file + ": texte attendu absent " + JSON.stringify(value));
  }
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log("Text quality smoke tests OK");

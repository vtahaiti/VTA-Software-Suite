// Verifie (statiquement, lecture de source) que Devis & Commandes est verrouille pour Restaurant a
// TOUS les niveaux demandes : acces direct par URL a /dashboard/sales, /quotes et /proformas (pas
// seulement le lien de menu cache), et les boutons POS "Creer devis"/"Creer commande".
// Le comportement runtime (le filtre excludedModules lui-meme) est verifie contre une vraie base
// dans restaurant-v1-menu-integrity-smoke.cjs ; ce script verifie que le code qui applique ce filtre
// cote frontend existe bien et est branche aux bons endroits.

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const guard = read("apps/web/components/excluded-module-guard.tsx");
expect(guard.includes("export function ExcludedModuleGuard"), "ExcludedModuleGuard doit exister et etre exporte");
expect(guard.includes("getTenantBusinessConfiguration"), "Le guard doit lire la configuration metier du tenant, pas une liste statique");
expect(guard.includes("excludedModules?.includes(moduleKey)"), "Le guard doit verifier excludedModules pour le moduleKey demande");
expect(guard.includes("router.replace(redirectTo)"), "Le guard doit rediriger (pas juste masquer) l'acces direct par URL");

for (const [file, label] of [
  ["apps/web/app/dashboard/sales/page.tsx", "page racine /dashboard/sales (Devis & Commandes)"],
  ["apps/web/app/dashboard/sales/quotes/layout.tsx", "toutes les routes /dashboard/sales/quotes/*"],
  ["apps/web/app/dashboard/sales/proformas/layout.tsx", "toutes les routes /dashboard/sales/proformas/*"]
]) {
  const source = read(file);
  expect(source.includes("ExcludedModuleGuard"), `${label} doit etre protege par ExcludedModuleGuard`);
  expect(source.includes('moduleKey="sales"'), `${label} doit verrouiller specifiquement le module "sales"`);
}

const posSource = read("apps/web/app/dashboard/pos/page.tsx");
expect(posSource.includes("canCreateQuotesOrders"), "pos/page.tsx doit calculer canCreateQuotesOrders");
expect(/canCreateQuotesOrders\s*=\s*!\(business\?\.excludedModules/.test(posSource), "canCreateQuotesOrders doit etre derive de business.excludedModules (matrice centrale), pas d'une liste de profils codee en dur");

const createButtonsGuarded = posSource.match(/props\.canCreateQuotesOrders \? \(/g) ?? [];
expect(createButtonsGuarded.length >= 2, `les 2 emplacements des boutons "Creer devis"/"Creer commande" doivent etre conditionnes par canCreateQuotesOrders (trouve ${createButtonsGuarded.length})`);
expect(posSource.includes("if (!canCreateQuotesOrders)"), "createPosDocument doit aussi refuser cote client si canCreateQuotesOrders est faux (defense en profondeur, pas seulement l'UI)");

if (failures.length) {
  console.error("Restaurant quotes lockout smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Restaurant quotes lockout smoke OK");

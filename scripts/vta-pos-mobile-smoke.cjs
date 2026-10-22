const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const capacitor = read("apps/web/capacitor.config.ts");
const shell = read("apps/web/components/protected-shell.tsx");
const nav = read("apps/web/components/native-mobile-nav.tsx");
const dashboard = read("apps/web/app/dashboard/page.tsx");
const pos = read("apps/web/app/dashboard/pos/page.tsx");
const inventory = read("apps/web/app/dashboard/inventory/page.tsx");
const manifest = read("apps/web/public/manifest.json");
const androidStrings = read("apps/web/android/app/src/main/res/values/strings.xml");

assert(capacitor.includes('appId: "com.vtaerp.commerce"'), "L'appId Android existant doit rester stable");
assert(capacitor.includes('appName: "VTA POS"'), "Le nom natif doit être VTA POS");
assert(manifest.includes('"name": "VTA POS"'), "Le manifeste installable doit utiliser VTA POS");
assert(androidStrings.includes(">VTA POS<"), "Le libellé Android doit utiliser VTA POS");
assert(shell.includes("NativeMobileNav"), "La navigation mobile doit être montée dans le shell protégé");
for (const label of ["Accueil", "Caisse", "Stock", "Plus"]) assert(nav.includes(label), `Navigation mobile manquante: ${label}`);
assert(nav.includes("canAccessHref"), "La navigation mobile doit respecter le RBAC");
assert(nav.includes('/dashboard/settings/pos'), "Le raccourci Imprimantes doit ouvrir la page de configuration existante");
assert(dashboard.includes("MobilePosDashboard"), "Le tableau de bord mobile VTA POS doit être présent");
assert(dashboard.includes("profitReliable"), "Le bénéfice mobile doit respecter la fiabilité des coûts");
assert(pos.includes("vta-native-cart-bar"), "Le panier mobile doit rester accessible au-dessus de la navigation");
assert(inventory.includes("vta-native-only"), "L'inventaire doit posséder une vue mobile dédiée");
assert(inventory.includes('params.set("lowStock", "true")'), "Le filtre stock faible doit appeler le serveur");

console.log("VTA POS mobile smoke: OK");

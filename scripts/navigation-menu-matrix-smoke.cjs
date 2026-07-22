const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const navigationSource = fs.readFileSync(path.join(root, "apps/web/lib/navigation.tsx"), "utf8");
const catalogSource = fs.readFileSync(path.join(root, "apps/api/src/business-profiles/business-catalog.ts"), "utf8");

function profileBlock(slug) {
  return catalogSource.match(new RegExp(`\\{\\s*slug:\\s*"${slug}"[\\s\\S]*?\\}`))?.[0] ?? "";
}

function profileHasModule(slug, moduleKey) {
  return profileBlock(slug).includes(`"${moduleKey}"`);
}

assert(navigationSource.includes('href === "/dashboard/sales/in-progress" && sourceHrefs.has("/dashboard/pos")'), "POS doit garder Ventes en attente.");
assert(navigationSource.includes('href === "/dashboard/sales/completed" && sourceHrefs.has("/dashboard/pos")'), "POS doit garder Historique des ventes.");
assert(!navigationSource.includes('href === "/dashboard/sales" && sourceHrefs.has("/dashboard/pos")'), "POS ne doit pas autoriser Devis & Commandes sans module sales.");
assert(navigationSource.includes("sourceLabels.get(child.href) ?? child.label"), "La navigation doit reprendre les libelles metier fournis par l'API.");
assert(navigationSource.includes("sourceLabels.get(item.href) ?? item.label"), "La navigation doit reprendre les libelles metier des liens principaux.");
assert(navigationSource.includes('id: "notifications"') && navigationSource.includes('href: "/dashboard/notifications"'), "Notifications doit pouvoir apparaitre quand le profil l'autorise.");

for (const slug of ["restaurant", "commerce", "pharmacy", "clinic", "hotel-restaurant"]) {
  assert.equal(profileHasModule(slug, "sales"), false, `${slug} ne doit pas activer Devis & Commandes par defaut.`);
}

for (const slug of ["multi-activities", "hardware", "construction-materials", "manufacturing", "windows-aluminium", "services", "it-services", "phone-sales-repair", "printing"]) {
  assert.equal(profileHasModule(slug, "sales"), true, `${slug} doit garder Devis & Commandes.`);
}

console.log("Navigation menu matrix smoke OK");

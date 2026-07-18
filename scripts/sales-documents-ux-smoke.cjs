const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const salesPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/page.tsx"), "utf8");
const documentPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/sales-document-page.tsx"), "utf8");
const navigationSmoke = fs.readFileSync(path.join(root, "scripts/navigation-menu-matrix-smoke.cjs"), "utf8");

for (const expected of [
  "Utilisez cette section pour preparer un devis, confirmer une commande, recevoir un acompte et suivre le solde restant.",
  "Devis client",
  "Preparer un prix sans toucher au stock.",
  "Commandes & acomptes",
  "Suivre les commandes confirmees, avances recues et soldes a payer.",
  "Soldes a recevoir",
  "Voir les commandes non soldees.",
  "Commandes terminees",
  "Voir les commandes cloturees.",
  "A ne pas confondre avec le POS",
  "Ventes en attente concerne les paniers POS suspendus."
]) {
  assert(salesPage.includes(expected), `Texte UX manquant sur /dashboard/sales: ${expected}`);
}

assert(documentPage.includes("Devis = proposition de prix."), "La page Devis doit expliquer le role du devis.");
assert(documentPage.includes("Commande = vente confirmee qui peut recevoir un acompte puis un solde."), "La page Commandes doit expliquer acompte/solde.");
assert(documentPage.includes("productSearch"), "Le select produit doit etre accompagne d'une recherche compacte.");
assert(documentPage.includes("filtered.slice(0, 25)"), "Le select produit doit limiter la liste visible.");
assert(documentPage.includes("Service / ligne personnalisee") || documentPage.includes("Service / ligne personnalis"), "Le select doit garder l'option service personnalise.");

assert(navigationSmoke.includes("restaurant") && navigationSmoke.includes("multi-activities"), "La matrice de menu doit couvrir Restaurant et Multi-activite.");

console.log("Sales documents UX smoke OK");

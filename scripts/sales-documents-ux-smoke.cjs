const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const salesPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/page.tsx"), "utf8");
const documentPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/sales-document-page.tsx"), "utf8");
const navigationSmoke = fs.readFileSync(path.join(root, "scripts/navigation-menu-matrix-smoke.cjs"), "utf8");

for (const expected of [
  "produit existant ou service personnalise",
  "Devis client",
  "Preparer un prix sans toucher au stock.",
  "Commandes & avances",
  "Suivre Total, Avance, Balance et statut.",
  "Balances a recevoir",
  "Commandes avec un reste a payer.",
  "Commandes terminees",
  "Commandes cloturees",
  "Flux separe du POS",
  "Ventes en attente = panier POS suspendu."
]) {
  assert(salesPage.includes(expected), `Texte UX manquant sur /dashboard/sales: ${expected}`);
}

assert(documentPage.includes("Devis = proposition de prix."), "La page Devis doit expliquer le role du devis.");
assert(documentPage.includes("Commande = vente confirmee qui peut recevoir une avance, puis la balance."), "La page Commandes doit expliquer avance/balance.");
assert(documentPage.includes("productSearches"), "Le select produit doit etre accompagne d'une recherche compacte par ligne.");
assert(documentPage.includes("filtered.slice(0, 20)"), "Le select produit doit limiter la liste visible.");
assert(documentPage.includes("Ajouter ligne personnalisee"), "Le select doit garder l'option ligne personnalisee.");
assert(documentPage.includes("paymentActionLabel"), "Les boutons doivent distinguer Ajouter avance et Encaisser balance.");

assert(navigationSmoke.includes("restaurant") && navigationSmoke.includes("multi-activities"), "La matrice de menu doit couvrir Restaurant et Multi-activite.");

console.log("Sales documents UX smoke OK");

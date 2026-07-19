const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const salesPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/page.tsx"), "utf8");
const documentPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/sales-document-page.tsx"), "utf8");
const navigationSmoke = fs.readFileSync(path.join(root, "scripts/navigation-menu-matrix-smoke.cjs"), "utf8");

for (const expected of [
  "Utilisez ce module quand un client demande un prix, confirme une commande, paie une avance, puis regle le solde.",
  "Devis client",
  "Preparer un prix sans toucher au stock.",
  "Commandes & acomptes",
  "Suivre total, acompte paye, solde restant et statut.",
  "Soldes a recevoir",
  "Commandes avec un montant restant a encaisser.",
  "Commandes terminees",
  "Commandes cloturees",
  "Flux separe du POS",
  "Ventes en attente = panier POS suspendu."
]) {
  assert(salesPage.includes(expected), `Texte UX manquant sur /dashboard/sales: ${expected}`);
}

assert(documentPage.includes("Devis = proposition de prix."), "La page Devis doit expliquer le role du devis.");
assert(documentPage.includes("Commande = vente confirmee qui peut recevoir un acompte, puis le solde restant."), "La page Commandes doit expliquer acompte/solde.");
assert(documentPage.includes("productSearch"), "Le select produit doit etre accompagne d'une recherche compacte.");
assert(documentPage.includes("filtered.slice(0, 12)"), "Le select produit doit limiter la liste visible.");
assert(documentPage.includes("+ Ajouter une ligne personnalisee"), "Le select doit garder l'option ligne personnalisee.");
assert(documentPage.includes("paymentActionLabel"), "Les boutons doivent distinguer Ajouter acompte et Encaisser solde.");

assert(navigationSmoke.includes("restaurant") && navigationSmoke.includes("multi-activities"), "La matrice de menu doit couvrir Restaurant et Multi-activite.");

console.log("Sales documents UX smoke OK");

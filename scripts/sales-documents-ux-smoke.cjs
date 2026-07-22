const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const salesPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/page.tsx"), "utf8");
const documentPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/sales/sales-document-page.tsx"), "utf8");
const navigationSmoke = fs.readFileSync(path.join(root, "scripts/navigation-menu-matrix-smoke.cjs"), "utf8");

for (const expected of [
  "Créer un devis",
  "Créer une commande",
  "Devis en attente",
  "Commandes en cours",
  "Ventes terminées",
  "Flux séparé du POS",
  "Ventes en attente = panier POS suspendu."
]) {
  assert(salesPage.includes(expected), `Texte UX manquant sur /dashboard/sales: ${expected}`);
}

assert(documentPage.includes("Le devis prépare un prix imprimable. Il ne modifie pas le stock et ne crée pas de vente POS."), "La page Devis doit expliquer le role du devis.");
assert(documentPage.includes("La commande sort le stock à la création et suit Total, Avance et Balance jusqu'à la vente terminée."), "La page Commandes doit expliquer avance/balance.");
assert(documentPage.includes("productSearch"), "Le champ produit doit etre accompagne d'une recherche compacte.");
assert(documentPage.includes("A) Produit du catalogue"), "Le formulaire doit séparér le produit catalogue.");
assert(documentPage.includes("B) Ligne personnalisée ou service"), "Le formulaire doit séparér la ligne personnalisée.");
assert(documentPage.includes("Ajouter au devis") && documentPage.includes("Ajouter à la commande"), "Les boutons d'ajout doivent etre explicites.");
assert(documentPage.includes("fromQuote"), "La commande créée depuis un devis doit reprendre ses lignes, modifiables avant confirmation.");

assert(navigationSmoke.includes("restaurant") && navigationSmoke.includes("multi-activities"), "La matrice de menu doit couvrir Restaurant et Multi-activité.");

console.log("Sales documents UX smoke OK");

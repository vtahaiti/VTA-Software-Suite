const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const salesPage = read("apps/web/app/dashboard/sales/page.tsx");
const documentPage = read("apps/web/app/dashboard/sales/sales-document-page.tsx");
const proformasPage = read("apps/web/app/dashboard/sales/proformas/page.tsx");
const quotesPage = read("apps/web/app/dashboard/sales/quotes/page.tsx");
const navigation = read("apps/web/lib/navigation.tsx");

for (const label of [
  "Devis en attente",
  "Commandes en preparation",
  "Avances recues",
  "Balances a recevoir",
  "Commandes pretes",
  "Commandes terminees",
  "Flux separe du POS",
  "produit existant ou service personnalise",
  "1. Devis",
  "2. Commande",
  "3. Avance",
  "4. Balance",
  "5. Termine"
]) {
  assert(salesPage.includes(label), `Tableau de bord Devis & Commandes incomplet: ${label}`);
}

for (const label of [
  "Creer un devis",
  "Nouvelle commande",
  "Ajouter produit existant",
  "Ajouter ligne personnalisee",
  "Rechercher par nom ou SKU",
  "Voir",
  "Imprimer",
  "Ajouter avance",
  "Encaisser balance",
  "Marquer prete",
  "Marquer livree",
  "Terminer",
  "Annuler",
  "md:hidden",
  "md:block"
]) {
  assert(documentPage.includes(label), `Flux documents V1 incomplet: ${label}`);
}

assert(documentPage.includes('window.location.search'), "Les cartes filtrees doivent initialiser le statut depuis l'URL.");
assert(documentPage.includes("filtered.slice(0, 20)"), "Le selecteur produit/service doit rester compact.");
assert(documentPage.includes("/products?${params}"), "La recherche produit existant doit passer par l'API produits.");
assert(!salesPage.includes("Factures et retours"), "La V1 ne doit pas remettre Factures/Retours au premier plan.");
assert(!documentPage.includes("Envoyer</button>") && !documentPage.includes("Accepter</button>"), "La V1 Devis doit privilegier Voir/Imprimer/Convertir/Annuler.");
assert(!proformasPage.includes("to-invoice"), "Commandes V1 ne doit pas pousser visuellement vers facture.");
assert(quotesPage.includes("Convertir en commande"), "Devis doit proposer la conversion en commande.");
assert(navigation.includes('id: "quotes-orders"'), "Le lien Devis & Commandes doit rester controle par la navigation.");

console.log("Sales orders V1 UX smoke OK");

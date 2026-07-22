const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const salesPage = read("apps/web/app/dashboard/sales/page.tsx");
const documentPage = read("apps/web/app/dashboard/sales/sales-document-page.tsx");
const detailPage = read("apps/web/app/dashboard/sales/sales-document-detail-page.tsx");
const proformasPage = read("apps/web/app/dashboard/sales/proformas/page.tsx");
const quotesPage = read("apps/web/app/dashboard/sales/quotes/page.tsx");
const navigation = read("apps/web/lib/navigation.tsx");

for (const label of [
  "Devis en attente",
  "Commandes en cours",
  "Ventes terminées",
  "Flux séparé du POS",
  "1. Devis (aucun impact stock)",
  "2. Commande (stock sorti)",
  "3. Balance à 0 = vente terminée"
]) {
  assert(salesPage.includes(label), `Tableau de bord Devis & Commandes incomplet: ${label}`);
}

for (const removed of ["Commandes en préparation", "Commandes prêtes", "Balances à recevoir", "Avances reçues", "5. Livraison", "6. Terminé"]) {
  assert(!salesPage.includes(removed), `Le tableau de bord ne doit plus exposer l'ancien pipeline détaillé: ${removed}`);
}

for (const label of [
  "Créer un devis",
  "Créer une commande",
  "A) Produit du catalogue",
  "B) Ligne personnalisée ou service",
  "Ajouter au devis",
  "Ajouter à la commande",
  "Lignes ajoutées",
  "Rechercher un produit",
  "Produit sélectionné",
  "Voir",
  "Imprimer",
  "Total",
  "Avance",
  "Balance",
  "md:hidden",
  "md:block"
]) {
  assert(documentPage.includes(label), `Flux documents incomplet: ${label}`);
}

for (const removed of ["Confirmer", "En préparation", "Marquer prête", "Marquer livrée", "Terminer"]) {
  assert(!documentPage.includes(removed), `Le pipeline de statuts commande détaillé doit être retiré: ${removed}`);
}

assert(documentPage.includes("Le devis prépare un prix imprimable. Il ne modifie pas le stock et ne crée pas de vente POS."), "Le devis doit rappeler l'absence d'impact stock/POS.");
assert(documentPage.includes("/products?${query.toString()}"), "La recherche produit existant doit passer par l'API produits.");
assert(documentPage.includes("setProducts((current)"), "Les résultats produits recherchés doivent être fusionnés pour garder la sélection.");
assert(!documentPage.includes("<select value={catalogLine.productId}"), "Le produit catalogue ne doit pas revenir en select natif lourd.");
assert(!documentPage.includes("product.sku} - {product.name}"), "La liste principale ne doit pas afficher SKU complet + nom + prix.");
assert(!documentPage.includes("Factures et retours"), "Le coeur Devis & Commandes ne doit pas mettre Factures/Retours au premier plan.");
assert(!documentPage.includes("Envoyer</button>") && !documentPage.includes("Accepter</button>"), "Les devis doivent privilégier Voir/Imprimer/Convertir/Annuler.");
assert(documentPage.includes("fromQuote"), "La création de commande doit pouvoir être préremplie depuis un devis, avec lignes modifiables.");
assert(detailPage.includes("Avance / balance enregistrée."), "Le détail commande doit pouvoir enregistrer avance/balance.");
assert(detailPage.includes("waitForPrintableImages"), "L'impression doit attendre les images du document.");
assert(detailPage.includes("Annuler la commande"), "La commande doit pouvoir être annulée (avec remise en stock).");
assert(!detailPage.includes("Marquer livrée"), "L'étape livraison séparée doit être retirée.");
assert(!proformasPage.includes("to-invoice"), "Commandes ne doit pas pousser visuellement vers facture : la facture se génère automatiquement à balance 0.");
assert(quotesPage.includes("Convertir en commande"), "Devis doit proposer la conversion en commande.");
assert(navigation.includes('id: "quotes-orders"'), "Le lien Devis & Commandes doit rester contrôlé par la navigation.");

console.log("Sales orders UX smoke OK");

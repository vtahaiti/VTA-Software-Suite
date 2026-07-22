const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const productsPage = read("apps/web/app/dashboard/products/page.tsx");
const productForm = read("apps/web/app/dashboard/products/product-form.tsx");
const createPage = read("apps/web/app/dashboard/products/create/page.tsx");
const editPage = read("apps/web/app/dashboard/products/[id]/edit/page.tsx");
const posPage = read("apps/web/app/dashboard/pos/page.tsx");

assert(createPage.includes("<ProductForm />"), "La création doit utiliser ProductForm.");
assert(editPage.includes("<ProductForm productId={params.id}"), "La modification doit utiliser le même ProductForm.");

for (const forbidden of [
  "Code disponible dans la fiche",
  "Coût manquant",
  "Service / non stocké",
  "Produit stocké",
  "Produit non stocké",
  "Service non stocké",
  "Minimum :"
]) {
  assert(!productsPage.includes(forbidden), `La liste Produits ne doit plus afficher: ${forbidden}`);
}

assert(productsPage.includes("<th className=\"p-3\">Quantité</th>"), "La liste Produits doit afficher une colonne Quantité.");
assert(productsPage.includes("ProductThumb"), "La liste Produits doit afficher une miniature ou des initiales.");
assert(productsPage.includes("QuantityDisplay"), "La quantité doit être rendue par un affichage simple.");
assert(productsPage.includes("Coût à compléter"), "Le coût manquant doit rester disponible sous forme discrète.");
assert(productsPage.includes("text-[11px]") && productsPage.includes("text-amber-600/75"), "Le coût manquant doit être visuellement discret.");
assert(!productsPage.includes("openQuickCost"), "Le bouton Coût ne doit plus apparaître sur chaque ligne.");
assert(productsPage.includes("Supprimer ce produit ? Cette action ne doit pas supprimer les anciennes ventes."), "La suppression produit doit demander confirmation.");
assert(productsPage.includes("method: \"DELETE\""), "La page Produits doit appeler l'endpoint de suppression.");

const modalStart = productsPage.indexOf("<Modal title=\"Nouveau produit\"");
const modalEnd = productsPage.indexOf(") : null}", modalStart);
const modalSection = productsPage.slice(modalStart, modalEnd);
const modalOrder = [
  "Nom du produit *",
  "Catégorie",
  "Prix d'achat / coût - facultatif",
  "Prix de vente *",
  "Quantité initiale",
  "Quantité minimale pour stock faible",
  "<ImagePicker",
  "Description courte facultative"
];
assert(modalStart >= 0 && modalEnd > modalStart, "Le formulaire Nouveau produit doit être présent.");
assertFieldOrder(modalSection, modalOrder, "Nouveau produit");
assert(!modalSection.includes("required type=\"number\" value={form.purchasePrice}"), "Le prix d'achat ne doit pas être obligatoire.");
assert(modalSection.indexOf("<ImagePicker") > modalSection.indexOf("Quantité minimale pour stock faible"), "L'image ne doit plus être le premier champ du nouveau produit.");

const mainSection = productForm.match(/<Section title="Produit">[\s\S]*?<\/Section>/)?.[0] ?? "";
const editOrder = [
  "Nom du produit *",
  "Catégorie",
  "Prix d'achat / coût - facultatif",
  "Prix de vente *",
  "Quantité initiale / stock actuel",
  "Quantité minimale pour stock faible",
  "Image produit",
  "Description courte facultative",
  "Produit actif"
];
assertFieldOrder(mainSection, editOrder, "Modifier produit");
assert(!mainSection.includes("Quantité actuelle"), "Modifier produit ne doit plus afficher le libellé ambigu Quantité actuelle.");
assert(!mainSection.includes("Produit sans suivi de stock"), "Le suivi de stock avancé ne doit pas être dans les champs principaux.");
assert(productForm.includes("showAdvancedOptions") && productForm.includes("showAdvancedOptions ? <div className=\"mt-5 space-y-5\">"), "Les options avancées doivent être rendues seulement après ouverture.");
assert(productForm.includes("<summary className=\"cursor-pointer text-lg font-semibold text-slate-950 dark:text-white\">Options avancées</summary>"), "Options avancées doit exister et être fermé par défaut.");

assert(productForm.includes("className=\"space-y-5 pb-4\""), "Le formulaire produit doit rester compact avec la barre d'action dans le flux.");
assert(productForm.includes("sticky bottom-0"), "Le formulaire produit doit afficher une barre d'action sticky en bas du formulaire.");
assert(!productForm.includes("fixed inset-x-0 bottom-0"), "La barre d'action ne doit pas être fixed pour éviter de cacher les champs sur laptop.");
assert(productForm.includes("Annuler / fermer"), "La barre d'action doit proposer Annuler / fermer.");
assert(productForm.includes("isSaving ? \"Enregistrement...\" : \"Enregistrer\""), "La barre d'action doit afficher Enregistrer et prevenir les doubles soumissions.");

for (const advanced of ["SKU automatique", "Code-barres", "QR code", "Référence", "Fournisseur principal", "Unité", "Prix gros", "Coût moyen", "Taxe", "Stock maximum", "Emplacement", "Couleur", "Dimensions", "Type / matériau", "Épaisseur / longueur", "Garantie", "Produit sans suivi de stock"]) {
  assert(productForm.includes(advanced), `Champ avancé attendu: ${advanced}`);
}

assert(!posPage.includes("Service / non stocké"), "Le POS ne doit plus afficher Service / non stocké.");
assert(!posPage.includes("Produit stocké"), "Le POS ne doit pas afficher Produit stocké.");
assert(!posPage.includes("Produit non stocké"), "Le POS ne doit pas afficher Produit non stocké.");
assert(posPage.includes("Stock ${product.availableStock}") || posPage.includes("Stock ${item.availableStock}"), "Le POS doit afficher une quantité simple quand elle est disponible.");
assert(posPage.includes("\"Disponible\""), "Le POS doit afficher un libellé discret pour les articles sans quantité suivie.");

function assertFieldOrder(source, labels, context) {
  let previousIndex = -1;
  for (const label of labels) {
    const index = source.indexOf(label);
    assert(index > previousIndex, `${context}: ordre de champ invalide ou champ absent: ${label}`);
    previousIndex = index;
  }
}

console.log("Product form UX smoke OK");

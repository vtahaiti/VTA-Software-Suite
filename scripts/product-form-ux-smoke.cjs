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
assert(!productsPage.includes("openQuickCost"), "Le bouton Coût ne doit plus apparaître sur chaque ligne.");

const mainSection = productForm.match(/<Section title="Produit">[\s\S]*?<\/Section>/)?.[0] ?? "";
for (const expected of ["Image produit", "Nom du produit", "Catégorie", "Prix de vente", "Quantité actuelle", "Quantité minimale", "Description courte", "Produit actif"]) {
  assert(mainSection.includes(expected), `Champ principal manquant: ${expected}`);
}
assert(mainSection.includes("Coût / prix d'achat"), "Le coût d'achat doit rester accessible dans les champs principaux.");
assert(!mainSection.includes("Produit sans suivi de stock"), "Le suivi de stock avancé ne doit pas être dans les champs principaux.");
assert(productForm.includes("<summary className=\"cursor-pointer text-lg font-semibold text-slate-950 dark:text-white\">Options avancées</summary>"), "Options avancées doit exister et être fermé par défaut.");

for (const advanced of ["SKU automatique", "Code-barres", "QR code", "Référence", "Fournisseur principal", "Unité", "Prix gros", "Coût moyen", "Taxe", "Stock maximum", "Emplacement", "Couleur", "Dimensions", "Type / matériau", "Épaisseur / longueur", "Garantie", "Produit sans suivi de stock"]) {
  assert(productForm.includes(advanced), `Champ avancé attendu: ${advanced}`);
}

assert(!posPage.includes("Service / non stocké"), "Le POS ne doit plus afficher Service / non stocké.");
assert(!posPage.includes("Produit stocké"), "Le POS ne doit pas afficher Produit stocké.");
assert(!posPage.includes("Produit non stocké"), "Le POS ne doit pas afficher Produit non stocké.");
assert(posPage.includes("Stock ${product.availableStock}") || posPage.includes("Stock ${item.availableStock}"), "Le POS doit afficher une quantité simple quand elle est disponible.");
assert(posPage.includes("\"Disponible\""), "Le POS doit afficher un libellé discret pour les articles sans quantité suivie.");

console.log("Product form UX smoke OK");

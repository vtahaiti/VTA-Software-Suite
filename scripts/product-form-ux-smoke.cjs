const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const productForm = fs.readFileSync(path.join(root, "apps/web/app/dashboard/products/product-form.tsx"), "utf8");
const createPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/products/create/page.tsx"), "utf8");
const editPage = fs.readFileSync(path.join(root, "apps/web/app/dashboard/products/[id]/edit/page.tsx"), "utf8");

assert(createPage.includes("<ProductForm />"), "La creation doit utiliser ProductForm.");
assert(editPage.includes("<ProductForm productId={params.id}"), "La modification doit utiliser le meme ProductForm.");

const essentialBlock = productForm.match(/<Section title="Essentiel produit">[\s\S]*?<\/Section>/)?.[0] ?? "";
assert(essentialBlock.includes("Nom du produit"), "Nom du produit doit rester visible.");
assert(essentialBlock.includes("Cat") && essentialBlock.includes("categoryId"), "Categorie doit etre visible dans les champs principaux.");
assert(essentialBlock.includes("Prix vente") || essentialBlock.includes("Prix de vente"), "Prix de vente doit etre visible.");
assert(essentialBlock.includes("Prix achat") || essentialBlock.includes("prix d'achat") || essentialBlock.includes("Coût"), "Cout / prix d'achat doit etre visible.");
assert(essentialBlock.includes("ProductStockModeField"), "Le choix Produit stocke / service doit etre visible.");
assert(essentialBlock.includes("Stock actuel"), "Stock actuel doit etre visible seulement quand Produit stocke.");
assert(essentialBlock.includes("Seuil minimum"), "Seuil minimum doit etre visible seulement quand Produit stocke.");
assert(essentialBlock.includes("Options avanc"), "Les champs secondaires doivent etre replies.");

for (const advanced of ["SKU automatique", "Code-barres", "Unité", "Fournisseur principal", "Référence", "Couleur", "Dimensions", "Type / mat"]) {
  assert(productForm.includes(advanced) || productForm.includes(advanced.normalize("NFD").replace(/\p{Diacritic}/gu, "")), `Champ avance attendu: ${advanced}`);
}

assert(productForm.includes("Plat / service non stocke"), "Restaurant doit garder Plat / service non stocke.");
assert(productForm.includes("Produit stocke"), "Restaurant et autres profils doivent garder Produit stocke.");
assert(productForm.includes('minimumStock: restaurantStockMode === "NON_STOCK" ? 0'), "Non-stock ne doit pas forcer de seuil minimum.");
assert(productForm.includes('stock: restaurantStockMode === "NON_STOCK" ? 0'), "Non-stock ne doit pas forcer de stock variante.");

console.log("Product form UX smoke OK");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const productsPage = read("apps/web/app/dashboard/products/page.tsx");
const productForm = read("apps/web/app/dashboard/products/product-form.tsx");

assert(productsPage.includes("nonStockProductLabel(business)"), "La liste produits doit utiliser un libellé non-stock contextualisé.");
assert(productForm.includes("nonStockProductLabel(business)"), "Le formulaire produit doit utiliser un libellé non-stock contextualisé.");
assert(productsPage.includes('return "Plat / service non stocké"'), "Restaurant doit pouvoir afficher Plat / service non stocké.");
assert(productsPage.includes('return "Service non stocké"'), "Multi-activité doit afficher Service non stocké.");
assert(productsPage.includes('return "Produit non stocké"'), "Commerce doit afficher Produit non stocké.");
assert(productsPage.includes("isMultiActivityServiceProduct"), "Les services Multi-activité stock 0/min 0 doivent être affichés non stockés.");
assert(productsPage.includes("isNonStrictServiceProduct"), "Les services évidents doivent rester non stockés si le profil tenant est incomplet mais non strictement stock.");
assert(productsPage.includes("current > 0 || minimum > 0"), "Un produit Multi-activité avec stock ou minimum doit rester stocké.");
assert(!productsPage.includes("ProductTypeHint"), "La liste produits ne doit plus répéter le type non-stock sous le nom.");
assert(!productsPage.includes("nonStockTypeBadgeForProduct"), "La liste produits ne doit plus répéter Service/Plat dans plusieurs colonnes.");
assert(productsPage.includes("Produits affichés"), "La pagination doit afficher le nombre réel de produits visibles.");
assert(productsPage.includes("Math.max(Number(data.meta?.total ?? 0), nextItems.length)"), "Le total ne doit pas tomber à zéro quand des produits sont affichés.");
assert(!productsPage.includes("ProductStockMeta"), "Le stock ne doit pas être répété sous le SKU dans la cellule Produit.");
assert(!productsPage.includes(">Service / plat<"), "La liste produits ne doit jamais afficher le badge brut Service / plat.");
assert(!productsPage.includes("Service / plat non stocké"), "La liste produits ne doit pas dupliquer Service / plat non stocké hors helper Restaurant.");
assert(!productsPage.includes("nonStockStockLabelForProduct"), "La colonne Stock ne doit pas répéter le type Service/Plat.");
assert(!productsPage.includes("Fournisseur:"), "La colonne Produit ne doit pas mélanger fournisseur et stock.");
assert(productsPage.includes("isStrictStockBusiness"), "Quincaillerie/Matériaux/Pharmacie doivent rester traités comme profils stock.");
assert(productsPage.includes("Minimum :"), "Les produits stockés doivent afficher le seuil minimum avec libellé.");
assert(productsPage.includes("Stock :"), "Les produits stockés doivent afficher le stock actuel clairement.");
assert(productsPage.includes("Coût manquant"), "Le coût manquant doit rester visible comme filtre/résumé discret.");
assert(!productsPage.includes("Coût non renseigné"), "La ligne produit ne doit plus répéter Coût non renseigné partout.");
assert(productsPage.includes(">Coût</button>"), "Les actions doivent exposer le bouton Coût.");

console.log("Products profile stock labels smoke OK");

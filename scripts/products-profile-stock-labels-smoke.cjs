const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const productsPage = read("apps/web/app/dashboard/products/page.tsx");
const productForm = read("apps/web/app/dashboard/products/product-form.tsx");

assert(productsPage.includes("nonStockProductLabel(business)"), "La liste produits doit utiliser un libelle non-stock contextualise.");
assert(productForm.includes("nonStockProductLabel(business)"), "Le formulaire produit doit utiliser un libelle non-stock contextualise.");
assert(productsPage.includes('return "Plat / service non stocke"'), "Restaurant doit pouvoir afficher Plat / service non stocke.");
assert(productsPage.includes('return "Service non stocke"'), "Multi-activite doit afficher Service non stocke.");
assert(productsPage.includes('return "Produit non stocke"'), "Commerce doit afficher Produit non stocke.");
assert(productsPage.includes("isMultiActivityServiceProduct"), "Les services Multi-activite stock 0/min 0 doivent etre affiches non stockes.");
assert(productsPage.includes("current > 0 || minimum > 0"), "Un produit Multi-activite avec stock ou minimum doit rester stocke.");
assert(productsPage.includes("ProductTypeHint"), "Le type non-stock doit etre affiche discretement dans la colonne Produit.");
assert(productsPage.includes("nonStockStockLabel"), "Le badge Stock doit utiliser un libelle court et contextualise.");
assert(!productsPage.includes("ProductStockMeta"), "Le stock ne doit pas etre repete sous le SKU dans la cellule Produit.");
assert(!productsPage.includes(">Service / plat<"), "La liste produits ne doit jamais afficher le badge brut Service / plat.");
assert(!productsPage.includes("Service / plat non stocke"), "La liste produits ne doit pas dupliquer Service / plat non stocke hors helper Restaurant.");
assert(!productsPage.includes("Fournisseur:"), "La colonne Produit ne doit pas melanger fournisseur et stock.");
assert(productsPage.includes("isStrictStockBusiness"), "Quincaillerie/Materiaux/Pharmacie doivent rester traites comme profils stock.");
assert(productsPage.includes("Minimum :"), "Les produits stockes doivent afficher le seuil minimum avec libelle.");
assert(productsPage.includes("Stock :"), "Les produits stockes doivent afficher le stock actuel clairement.");
assert(productsPage.includes("Cout non renseigne") || productsPage.includes("Coût non renseigné"), "Le cout manquant doit rester visible discretement.");
assert(productsPage.includes(">Cout</button>") || productsPage.includes(">Coût</button>"), "Les actions doivent exposer le bouton Cout.");

console.log("Products profile stock labels smoke OK");

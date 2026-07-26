const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const catalog = read("apps/api/src/onboarding/restaurant-starter-catalog.ts");
const onboarding = read("apps/api/src/onboarding/onboarding.service.ts");
const inventory = read("apps/web/app/dashboard/inventory/page.tsx");
const productForm = read("apps/web/app/dashboard/products/product-form.tsx");
const productsPage = read("apps/web/app/dashboard/products/page.tsx");
const posPage = read("apps/web/app/dashboard/pos/page.tsx");
const settingsController = read("apps/api/src/settings/settings.controller.ts");
const settingsService = read("apps/api/src/settings/restaurant-starter.service.ts");
const companySettings = read("apps/web/app/dashboard/settings/company/page.tsx");

for (const category of ["Plats", "Boissons", "Ingrédients", "Viandes & Poissons", "Fournitures", "Réserves"]) {
  assert(catalog.includes(`"${category}"`), `catégorie Restaurant manquante: ${category}`);
}
for (const warehouse of ["Frigo / Congélateur", "Bar / Boissons", "Cuisine / Ingrédients", "Dépôt", "Fournitures"]) {
  assert(catalog.includes(`name: "${warehouse}"`), `emplacement Restaurant manquant: ${warehouse}`);
}
for (const product of ["Viande", "Bière", "Riz", "Sac riz", "Assiettes jetables"]) {
  assert(catalog.includes(`"${product}"`), `article stocké modèle manquant: ${product}`);
}
assert(catalog.includes("quantity: 0, minimumStock: 0"), "les articles stockés démarrent à quantité zéro");
assert(!catalog.includes("inventoryMovement"), "aucun mouvement stock ne doit être créé pour une quantité nulle");
for (const product of ["Portion cabrit", "Portion poulet", "Poisson préparé", "Plat du jour", "Menu complet"]) {
  assert(catalog.includes(`"${product}"`), `article menu non stocké manquant: ${product}`);
}
assert(catalog.includes('model: "Produit sans suivi de stock"'), "les plats doivent être explicitement non suivis");
assert(onboarding.includes('selectedBusinessProfile.slug === "restaurant"'), "les modèles doivent être limités au profil Restaurant");
assert(onboarding.includes("createRestaurantStarterCatalog(tx, tenant.id, store.id)"), "l'onboarding Restaurant doit créer les modèles dans sa transaction");
assert(catalog.includes("tx.product.upsert") && catalog.includes("tx.stock.upsert"), "l'installation doit être répétable sans doublonner produits ou stocks");
assert(catalog.includes("update: {}"), "l'installation ne doit pas écraser les éléments existants");
assert(settingsController.includes('Post("company/install-restaurant-starter")'), "un endpoint manuel doit exister pour les tenants Restaurant actuels");
assert(settingsController.includes('@Permissions("settings.update", "settings.company")'), "l'installation manuelle doit être protégée par les permissions Paramètres");
assert(settingsService.includes("isRestaurantProfile") && settingsService.includes("réservés aux profils Restaurant"), "l'API doit refuser l'installation hors Restaurant");
assert(settingsService.includes("implements OnModuleInit") && settingsService.includes("async onModuleInit()"), "les tenants Restaurant existants doivent être complétés automatiquement au démarrage");
assert(settingsService.includes('status: { not: "DELETED" }'), "le rattrapage automatique ne doit jamais toucher les tenants supprimés");
assert(settingsService.includes("Object.values(result.created).some"), "le rattrapage doit s'appuyer sur le résultat idempotent");
assert(companySettings.includes("Installer les modèles Restaurant"), "Paramètres Entreprise doit proposer l'installation manuelle");
assert(companySettings.includes("Les produits, prix et stocks existants ne seront pas modifiés"), "la confirmation doit expliquer la conservation des données");
assert(inventory.includes('params.set("warehouseId", warehouseId)'), "Inventaire doit filtrer côté serveur par emplacement");
for (const filter of ["Tous", "Frigo", "Bar", "Cuisine", "Fournitures"]) assert(inventory.includes(filter), `filtre manquant: ${filter}`);
assert(productForm.includes('placeholder="Emplacement du stock"'), "le formulaire Produit doit afficher l'emplacement si le stock est suivi");
assert(productForm.indexOf('placeholder="Emplacement du stock"') < productForm.indexOf("<details open={showAdvancedOptions}"), "l'emplacement doit être un champ principal");
assert(productsPage.includes("product.stocks?.[0]?.warehouse?.name"), "la liste Produits doit afficher l'emplacement des articles suivis");
assert(productsPage.includes("Non suivi en stock"), "la liste Produits doit distinguer discrètement les plats non suivis");
assert(posPage.includes('const canCreateQuotesOrders = !(business?.excludedModules ?? []).includes("sales")'), "le POS doit respecter l'exclusion Devis & Commandes");
assert(posPage.includes("props.canCreateQuotesOrders ?"), "le POS doit masquer les actions de devis quand le module est exclu");

console.log("Restaurant stock templates smoke OK");

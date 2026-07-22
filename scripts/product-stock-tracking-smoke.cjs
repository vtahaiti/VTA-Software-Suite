const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const createDto = read("apps/api/src/products/dto/create-product.dto.ts");
const productsService = read("apps/api/src/products/products.service.ts");
const posService = read("apps/api/src/pos/pos.service.ts");
const salesService = read("apps/api/src/sales/sales.service.ts");
const stockService = read("apps/api/src/stock/stock.service.ts");
const productForm = read("apps/web/app/dashboard/products/product-form.tsx");
const productsPage = read("apps/web/app/dashboard/products/page.tsx");

assert(createDto.includes("trackStock"), "CreateProductDto doit accepter trackStock sans migration.");
assert(productsService.includes("const trackStock = dto.trackStock ??"), "La creation produit doit decider explicitement si le stock est suivi.");
assert(productsService.includes("if (trackStock)"), "trackStock=true doit creer une ligne Stock meme avec quantite 0.");
assert(productsService.includes("if (dto.trackStock === false) return;"), "trackStock=false ne doit pas creer/ajuster de stock.");
assert(productsService.includes("stockTracked"), "L'API produits doit exposer stockTracked pour l'affichage.");
assert(productsService.includes('reason: activatingStock ? "Activation suivi stock"'), "Activer le stock depuis Modifier doit auditer avec la raison Activation suivi stock.");
assert(productsService.includes("const stockTracked = !explicitlyNonStock && Number(product.stocks?.length ?? 0) > 0;"), "Un ancien produit ne doit etre suivi que s'il a une ligne Stock.");

for (const source of [productForm, productsPage]) {
  assert(source.includes("Gérer le stock de ce produit ?"), "Creer/Modifier doit afficher le choix simple de suivi stock.");
  assert(source.includes(">Oui</button>"), "Le choix Oui doit etre visible.");
  assert(source.includes(">Non</button>"), "Le choix Non doit etre visible.");
  assert(source.includes("trackStock"), "Le payload web doit envoyer trackStock.");
}

assert(productForm.includes("window.confirm"), "Desactiver le suivi stock existant doit demander une confirmation forte.");
assert(productForm.includes("!hasStockLine"), "Modifier doit deduire Non quand aucune ligne Stock n'existe.");
assert(productForm.includes("!form.noStockTracking ?"), "Modifier produit doit cacher quantite/minimum quand le stock n'est pas suivi.");
assert(productsPage.includes("form.trackStock ?"), "Nouveau produit doit cacher quantite/minimum quand le stock n'est pas suivi.");
assert(productsPage.includes("Non suivi en stock"), "La liste Produits doit afficher discretement les produits non suivis.");

assert(stockService.includes("sans suivi") && !stockService.includes("portion|menu|repas"), "L'inventaire doit utiliser le marqueur explicite, pas deviner par nom de produit.");
assert(stockService.includes("return Number(product.stocks?.length ?? 0) > 0;"), "Inventaire ne doit pas deduire le suivi stock depuis minimumStock seul.");
assert(posService.includes("isExplicitlyNonStock"), "Le POS doit respecter le choix Non meme si un ancien stock existe.");
assert(posService.includes("return Boolean((product.stocks?.length ?? 0) > 0);"), "Le POS doit traiter comme stocke seulement les produits avec ligne Stock.");
assert(salesService.includes("isStockTrackedProduct(item.product)"), "La vente finale doit respecter le choix Non pour ne pas decrementer.");
assert(salesService.includes("return Number(product.stocks?.length ?? 0) > 0;"), "La vente finale ne doit pas deduire le stock depuis minimumStock seul.");

console.log("Product stock tracking smoke OK");

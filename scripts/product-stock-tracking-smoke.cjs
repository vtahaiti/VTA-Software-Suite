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
assert(productsService.includes("const trackStock = dto.trackStock ??"), "La création produit doit décider explicitement si le stock est suivi.");
assert(productsService.includes("if (trackStock)"), "trackStock=true doit créer une ligne Stock même avec quantité 0.");
assert(productsService.includes("if (dto.trackStock === false) return;"), "trackStock=false ne doit pas créer/ajuster de stock.");
assert(productsService.includes("stockTracked"), "L'API produits doit exposer stockTracked pour l'affichage.");

for (const source of [productForm, productsPage]) {
  assert(source.includes("Gérer le stock de ce produit ?"), "Créer/Modifier doit afficher le choix simple de suivi stock.");
  assert(source.includes(">Oui</button>"), "Le choix Oui doit être visible.");
  assert(source.includes(">Non</button>"), "Le choix Non doit être visible.");
  assert(source.includes("trackStock"), "Le payload web doit envoyer trackStock.");
}

assert(productForm.includes("!form.noStockTracking ?"), "Modifier produit doit cacher quantité/minimum quand le stock n'est pas suivi.");
assert(productsPage.includes("form.trackStock ?"), "Nouveau produit doit cacher quantité/minimum quand le stock n'est pas suivi.");
assert(productsPage.includes("Non suivi en stock"), "La liste Produits doit afficher discrètement les produits non suivis.");

assert(stockService.includes("sans suivi") && !stockService.includes("portion|menu|repas"), "L'inventaire doit utiliser le marqueur explicite, pas deviner par nom de produit.");
assert(posService.includes("isExplicitlyNonStock"), "Le POS doit respecter le choix Non même si un ancien stock existe.");
assert(salesService.includes("isStockTrackedProduct(item.product)"), "La vente finale doit respecter le choix Non pour ne pas décrémenter.");

console.log("Product stock tracking smoke OK");

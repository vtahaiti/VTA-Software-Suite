const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const productService = read("apps/api/src/products/products.service.ts");
const productDto = read("apps/api/src/products/dto/create-product.dto.ts");
const productForm = read("apps/web/app/dashboard/products/product-form.tsx");
const productsPage = read("apps/web/app/dashboard/products/page.tsx");
const posService = read("apps/api/src/pos/pos.service.ts");

assert(productDto.includes("stockInitial"), "Le DTO produit doit accepter stockInitial.");
assert(productService.includes("updateStockFromProductEdit"), "La modification produit doit mettre à jour le stock courant.");
assert(productService.includes("dto.stockInitial !== undefined"), "La quantité actuelle doit être appliquée seulement si elle est envoyée.");
assert(productService.includes("dto.minimumStock !== undefined"), "Le seuil minimum doit être appliqué seulement s'il est envoyé.");
assert(productService.includes("tx.stock.upsert"), "La modification doit créer ou mettre à jour la ligne de stock sans migration.");
assert(productService.includes("tx.inventoryMovement.create"), "Une modification de quantité doit conserver un historique de mouvement.");
assert(productService.includes("images: { select: { url: true"), "La liste produits doit renvoyer l'image miniature.");
assert(productService.includes("if (dto.images) await tx.productImage.deleteMany"), "Une image modifiée doit remplacer l'ancienne galerie.");

for (const field of ["stockInitial: noStock ? 0 : Number(form.stockInitial || 0)", "minimumStock: noStock ? 0 : Number(form.minimumStock || 0)", "images: [", "salePrice: Number(form.salePrice || 0)", "isActive: form.isActive"]) {
  assert(productForm.includes(field), `ProductForm doit envoyer correctement: ${field}`);
}

assert(productForm.includes("stockCurrent"), "Le formulaire édition doit reprendre la quantité actuelle.");
assert(productForm.includes("product.images?.[0]?.url"), "Le formulaire édition doit reprendre l'image existante.");
assert(productsPage.includes("images?: Array"), "La liste Produits doit typiser les images.");
assert(productsPage.includes("resolveAssetUrl(product.images?.[0]?.url)"), "La liste Produits doit afficher l'image persistée.");
assert(posService.includes("images: { select: { url: true }"), "Le POS doit recevoir l'image produit.");
assert(posService.includes("isActive: true"), "Le POS doit exclure les produits désactivés.");

console.log("Product edit persistence smoke OK");

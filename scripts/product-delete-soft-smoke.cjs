const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("apps/api/src/products/products.service.ts");
const controller = read("apps/api/src/products/products.controller.ts");
const productsPage = read("apps/web/app/dashboard/products/page.tsx");
const posService = read("apps/api/src/pos/pos.service.ts");

const removeMatch = service.match(/async remove\(tenantId: string, id: string\) \{[\s\S]*?\n  \}/);
assert(removeMatch, "ProductsService.remove doit exister.");
const removeBody = removeMatch[0];

assert(removeBody.includes("await this.findOne(tenantId, id);"), "La suppression doit vérifier le tenant via findOne avant modification.");
assert(removeBody.includes("this.prisma.product.update"), "La suppression doit être logique avec product.update.");
assert(removeBody.includes("data: { isActive: false }"), "La suppression logique doit passer isActive à false.");
assert(removeBody.includes("mode: \"soft-delete\""), "La réponse doit indiquer une suppression logique.");
assert(!removeBody.includes("this.prisma.product.delete"), "La suppression produit ne doit pas supprimer physiquement.");

assert(controller.includes("@Delete(\":id\")"), "ProductsController doit exposer DELETE /products/:id.");
assert(controller.includes("@Permissions(\"products.delete\")"), "DELETE /products/:id doit exiger products.delete.");
assert(controller.includes("request.user.tenantId"), "Le controller doit passer tenantId au service.");

assert(productsPage.includes("Supprimer ce produit ? Cette action ne doit pas supprimer les anciennes ventes."), "La page Produits doit demander confirmation.");
assert(productsPage.includes("method: \"DELETE\""), "La page Produits doit appeler DELETE.");
assert(productsPage.includes("setItems((current) => current.filter((item) => item.id !== product.id))"), "La page doit retirer le produit désactivé de la liste courante.");
assert(productsPage.includes("setTotal((current) => Math.max(0, current - 1))"), "La pagination doit être mise à jour après suppression logique.");

assert(service.includes("isActive: query.isActive"), "La liste produits doit pouvoir filtrer les produits actifs.");
assert(productsPage.includes("isActive: \"true\""), "La page Produits principale doit charger uniquement les produits actifs.");
assert(posService.includes("isActive: true"), "Le POS doit continuer de masquer les produits inactifs.");

console.log("Product soft delete smoke OK");

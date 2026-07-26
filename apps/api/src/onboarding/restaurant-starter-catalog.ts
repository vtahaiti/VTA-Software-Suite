import { Prisma } from "@prisma/client";

const categories = ["Plats", "Boissons", "Ingrédients", "Viandes & Poissons", "Fournitures", "Réserves"] as const;
const warehouses = [
  { code: "DEPOT-PRINCIPAL", name: "Dépôt", description: "Réserves générales et grandes quantités." },
  { code: "FRIGO", name: "Frigo / Congélateur", description: "Produits périssables à surveiller." },
  { code: "BAR", name: "Bar / Boissons", description: "Boissons vendues directement au client." },
  { code: "CUISINE", name: "Cuisine / Ingrédients", description: "Ingrédients utilisés pour préparer les plats." },
  { code: "FOURNITURES", name: "Fournitures", description: "Matériel non alimentaire utilisé au service." }
] as const;
const trackedProducts = [
  ...["Viande", "Poisson", "Poulet", "Cabrit"].map((name) => ({ name, warehouseCode: "FRIGO", category: "Viandes & Poissons" })),
  ...["Légumes", "Jus frais", "Produits congelés"].map((name) => ({ name, warehouseCode: "FRIGO", category: "Ingrédients" })),
  ...["Bière", "Soda", "Eau", "Jus en bouteille", "Rhum", "Vin"].map((name) => ({ name, warehouseCode: "BAR", category: "Boissons" })),
  ...["Riz", "Huile", "Épices", "Farine", "Sauce tomate", "Sel", "Sucre", "Ail", "Oignon", "Piment", "Bouillon", "Pâtes", "Haricots", "Maïs moulu", "Banane", "Patate", "Légumes préparés"].map((name) => ({ name, warehouseCode: "CUISINE", category: "Ingrédients" })),
  ...["Sac riz", "Gallon huile", "Caisse bière", "Carton eau", "Carton soda", "Carton jus", "Sac charbon", "Bouteille gaz", "Carton serviettes"].map((name) => ({ name, warehouseCode: "DEPOT-PRINCIPAL", category: "Réserves" })),
  ...["Assiettes jetables", "Gobelets", "Serviettes", "Emballages", "Pailles", "Sacs", "Papier aluminium", "Film plastique", "Détergent", "Savon", "Éponge"].map((name) => ({ name, warehouseCode: "FOURNITURES", category: "Fournitures" }))
] as const;
const nonStockProducts = ["Portion cabrit", "Portion poulet", "Poisson préparé", "Plat du jour", "Menu complet"] as const;

type StarterTransaction = Pick<Prisma.TransactionClient, "category" | "warehouse" | "product" | "stock">;

export async function createRestaurantStarterCatalog(tx: StarterTransaction, tenantId: string, storeId: string) {
  const existingCategories = await tx.category.findMany({ where: { tenantId }, select: { slug: true } });
  const existingWarehouses = await tx.warehouse.findMany({ where: { tenantId }, select: { code: true } });
  const existingProducts = await tx.product.findMany({ where: { tenantId, sku: { startsWith: "VTA-REST-" } }, select: { sku: true } });
  const existingCategorySlugs = new Set(existingCategories.map((item) => item.slug));
  const existingWarehouseCodes = new Set(existingWarehouses.map((item) => item.code));
  const existingProductSkus = new Set(existingProducts.map((item) => item.sku));
  const savedCategories = new Map<string, string>();
  for (const name of categories) {
    const category = await tx.category.upsert({
      where: { tenantId_slug: { tenantId, slug: slugify(name) } },
      update: {},
      create: { tenantId, name, slug: slugify(name), isActive: true }
    });
    savedCategories.set(name, category.id);
  }

  const savedWarehouses = new Map<string, { id: string; storeId: string | null }>();
  for (const warehouse of warehouses) {
    const saved = await tx.warehouse.upsert({
      where: { tenantId_code: { tenantId, code: warehouse.code } },
      update: {},
      create: { tenantId, storeId, ...warehouse, isActive: true }
    });
    savedWarehouses.set(warehouse.code, { id: saved.id, storeId: saved.storeId });
  }

  for (const [index, template] of trackedProducts.entries()) {
    const warehouse = savedWarehouses.get(template.warehouseCode);
    if (!warehouse) continue;
    const sku = `VTA-REST-STOCK-${String(index + 1).padStart(3, "0")}`;
    const product = await tx.product.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      update: {},
      create: {
        tenantId,
        categoryId: savedCategories.get(template.category),
        warehouseId: warehouse.id,
        sku,
        name: template.name,
        purchasePrice: 0,
        salePrice: 0,
        minimumStock: 0
      }
    });
    await tx.stock.upsert({
      where: { tenantId_productId_warehouseId: { tenantId, productId: product.id, warehouseId: warehouse.id } },
      update: {},
      create: { tenantId, productId: product.id, warehouseId: warehouse.id, quantity: 0, minimumStock: 0 }
    });
  }

  for (const [index, name] of nonStockProducts.entries()) {
    const sku = `VTA-REST-MENU-${String(index + 1).padStart(3, "0")}`;
    await tx.product.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      update: {},
      create: {
        tenantId,
        categoryId: savedCategories.get("Plats"),
        sku,
        name,
        purchasePrice: 0,
        salePrice: 0,
        minimumStock: 0,
        variants: { create: [{ name, model: "Produit sans suivi de stock", stock: 0 }] }
      }
    });
  }
  return {
    warehouse: savedWarehouses.get("DEPOT-PRINCIPAL"),
    created: {
      categories: categories.filter((name) => !existingCategorySlugs.has(slugify(name))).length,
      warehouses: warehouses.filter((item) => !existingWarehouseCodes.has(item.code)).length,
      trackedProducts: trackedProducts.filter((_, index) => !existingProductSkus.has(`VTA-REST-STOCK-${String(index + 1).padStart(3, "0")}`)).length,
      nonStockProducts: nonStockProducts.filter((_, index) => !existingProductSkus.has(`VTA-REST-MENU-${String(index + 1).padStart(3, "0")}`)).length
    }
  };
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const restaurantStarterCatalog = { categories, warehouses, trackedProducts, nonStockProducts };

// Verifie contre une vraie base Postgres, avec les VRAIS services compiles (apps/api/dist), que :
// 1) le POS Restaurant n'affiche que les produits vendables (sellable=true) : les ingredients/consommables
//    internes (Ail, Gobelets, Detergent, Farine) restent hors POS, meme s'ils ont du stock.
// 2) l'Inventaire/Produits (GET /products) continue de lister TOUS les produits, vendables ou non.
// 3) le scan code-barres en POS Restaurant respecte le meme filtre.
// 4) un tenant non-Restaurant (Commerce) n'est pas affecte : son POS montre tout, comme avant.

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://vta:vta_password@localhost:5432/vta_commerce?schema=public";
}

const path = require("path");
const distApi = path.join(__dirname, "..", "apps", "api", "dist");

const { PrismaService } = require(path.join(distApi, "prisma", "prisma.service.js"));
const { StockService } = require(path.join(distApi, "stock", "stock.service.js"));
const { SalesService } = require(path.join(distApi, "sales", "sales.service.js"));
const { PosService } = require(path.join(distApi, "pos", "pos.service.js"));
const { ProductsService } = require(path.join(distApi, "products", "products.service.js"));

function assert(condition, message) {
  if (!condition) throw new Error("FAIL: " + message);
}

function names(list) {
  return list.map((item) => item.name);
}

async function main() {
  const prisma = new PrismaService();
  const stock = new StockService(prisma);
  const sales = new SalesService(prisma, stock);
  const pos = new PosService(prisma, sales);
  const products = new ProductsService(prisma);
  const suffix = Date.now().toString(36);

  const stockOnly = ["Ail", "Gobelets", "Détergent", "Farine"];
  const sellableItems = ["Bière", "Plat du jour"];

  const restaurantTenant = await prisma.tenant.create({
    data: { name: "Restaurant POS Sellable Smoke", slug: `restaurant-pos-sellable-smoke-${suffix}`, status: "TRIAL", businessProfileType: "restaurant" }
  });
  const commerceTenant = await prisma.tenant.create({
    data: { name: "Commerce POS Sellable Smoke", slug: `commerce-pos-sellable-smoke-${suffix}`, status: "TRIAL", businessProfileType: "commerce" }
  });

  try {
    for (const tenant of [restaurantTenant, commerceTenant]) {
      for (const name of stockOnly) {
        await products.create(tenant.id, { name: `${name} ${suffix}`, salePrice: 0, sellable: false, barcodes: [{ value: `${name}-${tenant.id}`, type: "CUSTOM", isPrimary: true }] });
      }
      for (const name of sellableItems) {
        await products.create(tenant.id, { name: `${name} ${suffix}`, salePrice: 250, sellable: true, barcodes: [{ value: `${name}-${tenant.id}`, type: "CUSTOM", isPrimary: true }] });
      }
    }

    // --- Scenario 1 : POS Restaurant exclut le stock-only ---
    const restaurantPos = await pos.searchProducts(restaurantTenant.id, { page: 1, limit: 100 });
    const restaurantPosNames = names(restaurantPos.items);
    for (const name of stockOnly) {
      assert(!restaurantPosNames.some((item) => item.startsWith(name)), `POS Restaurant ne doit pas afficher l'article stock-only: ${name}`);
    }
    for (const name of sellableItems) {
      assert(restaurantPosNames.some((item) => item.startsWith(name)), `POS Restaurant doit afficher l'article vendable: ${name}`);
    }
    console.log("scenario 1 OK : POS Restaurant n'affiche que les articles vendables (Ail/Gobelets/Détergent/Farine exclus, Bière/Plat présents)");

    // --- Scenario 2 : Inventaire/Produits garde tout ---
    const restaurantProducts = await products.findAll(restaurantTenant.id, { page: 1, limit: 100 });
    const restaurantProductNames = names(restaurantProducts.items);
    for (const name of [...stockOnly, ...sellableItems]) {
      assert(restaurantProductNames.some((item) => item.startsWith(name)), `Inventaire/Produits doit garder l'article ${name} qu'il soit vendable ou non`);
    }
    console.log("scenario 2 OK : Produits/Inventaire liste tous les articles, vendables ou stock-only");

    // --- Scenario 3 : scan code-barres respecte le meme filtre ---
    let scanBlocked = false;
    try {
      await pos.scanProduct(restaurantTenant.id, `Ail-${restaurantTenant.id}`);
    } catch (error) {
      scanBlocked = true;
    }
    assert(scanBlocked, "Le scan code-barres en POS Restaurant doit refuser un article stock-only (Ail)");
    const scannedBeer = await pos.scanProduct(restaurantTenant.id, `Bière-${restaurantTenant.id}`);
    assert(scannedBeer && scannedBeer.name.startsWith("Bière"), "Le scan code-barres en POS Restaurant doit accepter un article vendable (Bière)");
    console.log("scenario 3 OK : le scan code-barres POS respecte le meme filtre sellable");

    // --- Scenario 4 : Commerce non affecte, POS montre tout comme avant ---
    const commercePos = await pos.searchProducts(commerceTenant.id, { page: 1, limit: 100 });
    const commercePosNames = names(commercePos.items);
    for (const name of [...stockOnly, ...sellableItems]) {
      assert(commercePosNames.some((item) => item.startsWith(name)), `Commerce: le POS doit rester inchangé et afficher ${name} malgré sellable=false`);
    }
    const commerceScan = await pos.scanProduct(commerceTenant.id, `Ail-${commerceTenant.id}`);
    assert(commerceScan && commerceScan.name.startsWith("Ail"), "Commerce: le scan code-barres doit rester inchangé et accepter un article sellable=false");
    console.log("scenario 4 OK : tenant Commerce non affecté, POS et scan montrent tout comme avant");
  } finally {
    for (const tenant of [restaurantTenant, commerceTenant]) {
      await prisma.priceHistory.deleteMany({ where: { product: { tenantId: tenant.id } } }).catch(() => {});
      await prisma.barcode.deleteMany({ where: { product: { tenantId: tenant.id } } }).catch(() => {});
      await prisma.stock.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
      await prisma.product.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
    }
  }

  await prisma.$disconnect();
  console.log("RESTAURANT_POS_SELLABLE_SMOKE_OK");
}

main().catch((error) => { console.error(error); process.exit(1); });

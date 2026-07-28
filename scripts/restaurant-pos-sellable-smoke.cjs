// Verifie contre une vraie base Postgres, avec les VRAIS services compiles (apps/api/dist), que :
// 1) le POS Restaurant n'affiche que les produits vendables (sellable=true) : les ingredients/consommables
//    internes (Ail, Gobelets, Detergent, Farine) restent hors POS, meme s'ils ont du stock.
// 2) l'Inventaire/Produits (GET /products) continue de lister TOUS les produits, vendables ou non.
// 3) le scan code-barres en POS Restaurant respecte le meme filtre.
// 4) Hôtel-restaurant applique le même filtre que Restaurant.
// 5) les tenants Commerce et Fashion ne sont pas affectés : leur POS montre tout, comme avant.

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
  const hotelRestaurantTenant = await prisma.tenant.create({
    data: { name: "Hotel Restaurant POS Sellable Smoke", slug: `hotel-restaurant-pos-sellable-smoke-${suffix}`, status: "TRIAL", businessProfileType: "hotel-restaurant" }
  });
  const commerceTenant = await prisma.tenant.create({
    data: { name: "Commerce POS Sellable Smoke", slug: `commerce-pos-sellable-smoke-${suffix}`, status: "TRIAL", businessProfileType: "commerce" }
  });
  const fashionTenant = await prisma.tenant.create({
    data: { name: "Fashion POS Sellable Smoke", slug: `fashion-pos-sellable-smoke-${suffix}`, status: "TRIAL", businessProfileType: "fashion" }
  });

  try {
    for (const tenant of [restaurantTenant, hotelRestaurantTenant, commerceTenant, fashionTenant]) {
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

    // --- Scenario 4 : Hôtel-restaurant exclut les chambres/services non vendables ---
    const hotelPos = await pos.searchProducts(hotelRestaurantTenant.id, { page: 1, limit: 100 });
    const hotelPosNames = names(hotelPos.items);
    for (const name of stockOnly) {
      assert(!hotelPosNames.some((item) => item.startsWith(name)), `POS Hôtel-restaurant ne doit pas afficher l'article non vendable: ${name}`);
    }
    for (const name of sellableItems) {
      assert(hotelPosNames.some((item) => item.startsWith(name)), `POS Hôtel-restaurant doit garder l'article vendable: ${name}`);
    }
    console.log("scenario 4 OK : Hôtel-restaurant exclut les chambres/services non vendables et garde repas/boissons vendables");

    // --- Scenario 5 : Commerce et Fashion non affectés ---
    for (const tenant of [commerceTenant, fashionTenant]) {
      const tenantPos = await pos.searchProducts(tenant.id, { page: 1, limit: 100 });
      const tenantPosNames = names(tenantPos.items);
      for (const name of [...stockOnly, ...sellableItems]) {
        assert(tenantPosNames.some((item) => item.startsWith(name)), `${tenant.businessProfileType}: le POS doit rester inchangé et afficher ${name} malgré sellable=false`);
      }
      const scanned = await pos.scanProduct(tenant.id, `Ail-${tenant.id}`);
      assert(scanned && scanned.name.startsWith("Ail"), `${tenant.businessProfileType}: le scan doit rester inchangé et accepter un article sellable=false`);
    }
    console.log("scenario 5 OK : tenants Commerce et Fashion non affectés");
  } finally {
    for (const tenant of [restaurantTenant, hotelRestaurantTenant, commerceTenant, fashionTenant]) {
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

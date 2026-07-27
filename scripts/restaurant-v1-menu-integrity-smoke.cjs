// Verifie contre une vraie base Postgres, avec les VRAIS services compiles (apps/api/dist), que :
// 1) un tenant Restaurant ne voit jamais "Devis & Commandes", meme si le module "sales" a ete active
//    manuellement (le bug reel corrige le 2026-07-25 : une bascule manuelle sur
//    /dashboard/settings/business-modules laissait une ligne TenantBusinessModule "sales" active pour
//    toujours, sans jamais etre reprise par le profil metier).
// 2) un tenant Commerce n'est pas affecte par ce nouveau filtre (aucune regression sur les autres profils).
// 3) la selection Table / Comptoir / Emporter en POS survit du "hold" a la liste des commandes ouvertes,
//    jusqu'a la finalisation et au ticket final (le champ Sale.note, jusque-la inutilise par le POS).

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://vta:vta_password@localhost:5432/vta_commerce?schema=public";
}

const path = require("path");
const distApi = path.join(__dirname, "..", "apps", "api", "dist");

const { PrismaService } = require(path.join(distApi, "prisma", "prisma.service.js"));
const { StockService } = require(path.join(distApi, "stock", "stock.service.js"));
const { SalesService } = require(path.join(distApi, "sales", "sales.service.js"));
const { PosService } = require(path.join(distApi, "pos", "pos.service.js"));
const { BusinessProfilesService } = require(path.join(distApi, "business-profiles", "business-profiles.service.js"));

function assert(condition, message) {
  if (!condition) throw new Error("FAIL: " + message);
}

function hrefs(configuration) {
  return configuration.menuSections.flatMap((section) => section.items.map((item) => item.href));
}

async function main() {
  const prisma = new PrismaService();
  const stock = new StockService(prisma);
  const sales = new SalesService(prisma, stock);
  const pos = new PosService(prisma, sales);
  const businessProfiles = new BusinessProfilesService(prisma);
  const suffix = Date.now().toString(36);

  // --- Scenario 1 & 2 : menu leak fix, restaurant vs commerce ---
  const restaurantTenant = await prisma.tenant.create({ data: { name: "Restaurant Menu Smoke", slug: `restaurant-menu-smoke-${suffix}`, status: "TRIAL" } });
  // Fabrication est un des profils que l'utilisateur a explicitement demande de ne pas casser, et
  // contrairement a Commerce, il inclut reellement le module "sales" par defaut : bon candidat pour
  // prouver que le nouveau filtre excludedModules ne touche QUE les profils qui l'ont explicitement.
  const commerceTenant = await prisma.tenant.create({ data: { name: "Fabrication Menu Smoke", slug: `manufacturing-menu-smoke-${suffix}`, status: "TRIAL" } });
  try {
    await businessProfiles.assignInitialProfile(restaurantTenant.id, "restaurant");
    await businessProfiles.assignInitialProfile(commerceTenant.id, "manufacturing");

    const restaurantBefore = await businessProfiles.tenantConfiguration(restaurantTenant.id);
    assert(!hrefs(restaurantBefore).includes("/dashboard/sales"), "restaurant: Devis & Commandes ne doit pas apparaitre par defaut");
    assert(hrefs(restaurantBefore).includes("/dashboard/restaurant/stock"), "restaurant: le menu doit inclure la nouvelle entree Stock Restaurant");
    console.log("scenario 1a OK : tenant restaurant fraichement cree, pas de Devis & Commandes, avec Stock Restaurant");

    // Simule le bug reel : un admin restaurant bascule manuellement "Ventes" sur la page des modules.
    await businessProfiles.setModuleState(restaurantTenant.id, "sales", true);
    const manualRow = await prisma.tenantBusinessModule.findFirst({ where: { tenantId: restaurantTenant.id, businessModule: { key: "sales" } } });
    assert(manualRow && manualRow.isActive && manualRow.source === "manual", "la ligne TenantBusinessModule manuelle doit exister avec source=manual (verifie qu'on teste bien le bon scenario)");

    const restaurantAfterManualToggle = await businessProfiles.tenantConfiguration(restaurantTenant.id);
    assert(!hrefs(restaurantAfterManualToggle).includes("/dashboard/sales"), "restaurant: Devis & Commandes ne doit JAMAIS apparaitre, meme avec une ligne manuelle active en base (c'est le vrai bug corrige)");
    assert(restaurantAfterManualToggle.excludedModules.includes("sales"), "la reponse API doit exposer excludedModules pour que le frontend masque la case a cocher");
    console.log("scenario 1b OK : Devis & Commandes reste absent meme avec un module 'sales' force actif en base (le vrai bug est corrige)");

    const commerceConfig = await businessProfiles.tenantConfiguration(commerceTenant.id);
    assert(hrefs(commerceConfig).includes("/dashboard/sales"), "fabrication: Devis & Commandes doit rester present (aucune regression sur les autres profils)");
    assert((commerceConfig.excludedModules ?? []).length === 0, "fabrication: excludedModules doit rester vide (le filtre ne doit s'appliquer qu'aux profils qui l'ont explicitement)");
    assert(!hrefs(commerceConfig).includes("/dashboard/restaurant/stock"), "fabrication: Stock Restaurant ne doit pas apparaitre, c'est une entree reservee au profil Restaurant");
    console.log("scenario 2 OK : tenant fabrication non affecte, Devis & Commandes toujours present, pas de Stock Restaurant");

    // Demande explicite : Multi-activite, Quincaillerie et Services doivent garder Devis & Commandes.
    for (const slug of ["multi-activities", "hardware", "services"]) {
      const tenant = await prisma.tenant.create({ data: { name: `Keep-sales ${slug}`, slug: `keep-sales-${slug}-${suffix}`, status: "TRIAL" } });
      try {
        await businessProfiles.assignInitialProfile(tenant.id, slug);
        const config = await businessProfiles.tenantConfiguration(tenant.id);
        assert(hrefs(config).includes("/dashboard/sales"), `${slug}: Devis & Commandes doit rester present`);
        assert((config.excludedModules ?? []).length === 0, `${slug}: excludedModules doit rester vide`);
      } finally {
        await prisma.tenantBusinessModule.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenantBusinessProfile.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
      }
    }
    console.log("scenario 2b OK : multi-activities, hardware, services gardent Devis & Commandes");

    // Restaurant ne peut pas non plus creer un devis/commande depuis le POS (canCreateQuotesOrders).
    const hotelRestaurantTenant = await prisma.tenant.create({ data: { name: "Hotel Restaurant Menu Smoke", slug: `hotel-restaurant-menu-smoke-${suffix}`, status: "TRIAL" } });
    try {
      await businessProfiles.assignInitialProfile(hotelRestaurantTenant.id, "hotel-restaurant");
      const hotelRestaurantConfig = await businessProfiles.tenantConfiguration(hotelRestaurantTenant.id);
      assert(!hrefs(hotelRestaurantConfig).includes("/dashboard/sales"), "hotel-restaurant: Devis & Commandes ne doit pas apparaitre");
      assert(hotelRestaurantConfig.excludedModules.includes("sales"), "hotel-restaurant: excludedModules doit inclure sales");
    } finally {
      await prisma.tenantBusinessModule.deleteMany({ where: { tenantId: hotelRestaurantTenant.id } });
      await prisma.tenantBusinessProfile.deleteMany({ where: { tenantId: hotelRestaurantTenant.id } });
      await prisma.tenant.delete({ where: { id: hotelRestaurantTenant.id } }).catch(() => {});
    }
    console.log("scenario 2c OK : hotel-restaurant aussi exclu de Devis & Commandes");
  } finally {
    await prisma.tenantBusinessModule.deleteMany({ where: { tenantId: { in: [restaurantTenant.id, commerceTenant.id] } } });
    await prisma.tenantBusinessProfile.deleteMany({ where: { tenantId: { in: [restaurantTenant.id, commerceTenant.id] } } });
    await prisma.tenant.delete({ where: { id: restaurantTenant.id } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: commerceTenant.id } }).catch(() => {});
  }

  // --- Scenario 3 : Table / Comptoir round-trip (hold -> liste -> finalize -> ticket) ---
  const posTenant = await prisma.tenant.create({ data: { name: "Restaurant POS Smoke", slug: `restaurant-pos-smoke-${suffix}`, status: "TRIAL" } });
  try {
    const server = await prisma.user.create({ data: { tenantId: posTenant.id, email: `server-${suffix}@smoke.test`, name: "Server Smoke", password: "test" } });
    const store = await prisma.store.create({ data: { tenantId: posTenant.id, code: "S1", name: "Salle" } });
    const warehouse = await prisma.warehouse.create({ data: { tenantId: posTenant.id, storeId: store.id, code: "W1", name: "Cuisine", isActive: true } });
    const dish = await prisma.product.create({ data: { tenantId: posTenant.id, sku: `DISH-${suffix}`, name: "Poulet grille", purchasePrice: 0, salePrice: 500, minimumStock: 0 } });
    await prisma.stock.create({ data: { tenantId: posTenant.id, productId: dish.id, warehouseId: warehouse.id, quantity: 20, minimumStock: 0 } });
    const cashRegister = await prisma.cashRegister.create({ data: { tenantId: posTenant.id, storeId: store.id, name: "Caisse 1", code: "CR1" } });
    const cashSession = await prisma.cashSession.create({ data: { tenantId: posTenant.id, cashRegisterId: cashRegister.id, openedById: server.id, openingAmount: 0 } });

    const cart = { items: [{ productId: dish.id, name: dish.name, quantity: 1, unitPrice: 500, discount: 0, total: 500 }], total: 500 };
    const held = await pos.saveHeldSale(posTenant.id, server.id, "session-1", {
      cart, storeId: store.id, warehouseId: warehouse.id, cashSessionId: cashSession.id, total: 500, note: "Table 7"
    });
    assert(held.note === "Table 7", "le hold doit persister la note Table/Comptoir telle quelle");

    const list = await pos.listHeldSales(posTenant.id, server.id, "session-1", true);
    const listed = list.items.find((item) => item.id === held.id);
    assert(listed, "la vente en attente doit apparaitre dans la liste");
    assert(listed.note === "Table 7", "la liste des commandes ouvertes doit exposer la note Table/Comptoir");
    assert(listed.createdByName === "Server Smoke", `la liste doit exposer le nom du createur, recu: ${listed.createdByName}`);
    console.log("scenario 3a OK : hold + liste des commandes ouvertes exposent Table/Comptoir et le createur");

    await pos.claimHeldSale(posTenant.id, server.id, "session-1", held.id);
    const finalized = await pos.finalizeHeldSale(posTenant.id, server.id, "session-1", held.id, {
      storeId: store.id, warehouseId: warehouse.id, cashSessionId: cashSession.id,
      items: [{ productId: dish.id, quantity: 1, unitPrice: 500, discount: 0 }],
      payments: [{ method: "CASH", amount: 500 }],
      note: "Table 7"
    }, `idem-${suffix}`);
    assert(finalized.note === "Table 7", `la vente finalisee doit conserver la note Table/Comptoir sur le ticket, recu: ${finalized.note}`);
    assert(finalized.createdById === server.id, "le createur original doit rester le Caissier affiche sur le ticket (comportement existant, non modifie)");
    console.log("scenario 3b OK : la finalisation conserve Table/Comptoir sur la vente, prete pour le ticket");
  } finally {
    await prisma.payment.deleteMany({ where: { sale: { tenantId: posTenant.id } } }).catch(() => {});
    await prisma.saleItem.deleteMany({ where: { sale: { tenantId: posTenant.id } } }).catch(() => {});
    await prisma.sale.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.heldSale.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.cashSession.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.cashRegister.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.stock.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.product.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.warehouse.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.store.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { tenantId: posTenant.id } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: posTenant.id } }).catch(() => {});
  }

  await prisma.$disconnect();
  console.log("RESTAURANT_V1_MENU_INTEGRITY_SMOKE_OK");
}

main().catch((error) => { console.error(error); process.exit(1); });

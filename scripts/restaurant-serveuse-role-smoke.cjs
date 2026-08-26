// End-to-end service smoke for the Restaurant Serveuse -> Caissier handoff.
// Uses a throwaway local tenant and deletes it when finished.

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://vta:vta_password@localhost:5432/vta_commerce?schema=public";

const path = require("path");
const fs = require("fs");
const distApi = path.join(__dirname, "..", "apps", "api", "dist");
const { PrismaService } = require(path.join(distApi, "prisma", "prisma.service.js"));
const { UsersService } = require(path.join(distApi, "users", "users.service.js"));
const { PosService } = require(path.join(distApi, "pos", "pos.service.js"));
const { PosController } = require(path.join(distApi, "pos", "pos.controller.js"));
const { SalesService } = require(path.join(distApi, "sales", "sales.service.js"));
const { StockService } = require(path.join(distApi, "stock", "stock.service.js"));
const { InvoicePrintService } = require(path.join(distApi, "print", "invoice-print.service.js"));
const { comparePassword } = require(path.join(distApi, "auth", "password-hashing.js"));
const { AuthService } = require(path.join(distApi, "auth", "auth.service.js"));
const { JwtService } = require("@nestjs/jwt");

const checks = [];
function check(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
}
async function expectForbidden(name, action) {
  let forbidden = false;
  try { await action(); } catch (error) { forbidden = error?.status === 403 || error?.response?.statusCode === 403; }
  check(name, forbidden);
}

async function main() {
  const prisma = new PrismaService();
  const users = new UsersService(prisma, { invalidateUserSessions: () => undefined });
  const stockService = new StockService(prisma);
  const sales = new SalesService(prisma, stockService);
  const pos = new PosService(prisma, sales);
  const controller = new PosController(pos, sales);
  const printer = new InvoicePrintService(prisma, {});
  const security = {
    isBlocked: async () => false,
    recordBlockedLogin: async () => undefined,
    recordLoginFailure: async () => undefined,
    recordLoginSuccess: async () => undefined
  };
  const auth = new AuthService(new JwtService(), prisma, security, { create: async () => undefined }, {});
  const stamp = Date.now();
  const tenant = await prisma.tenant.create({ data: { name: `QA Restaurant Serveuse ${stamp}`, slug: `qa-restaurant-serveuse-${stamp}`, businessProfileType: "restaurant", primaryActivity: "restaurant", status: "TRIAL" } });

  const posPage = fs.readFileSync(path.join(__dirname, "..", "apps", "web", "app", "dashboard", "pos", "page.tsx"), "utf8");
  const usersPage = fs.readFileSync(path.join(__dirname, "..", "apps", "web", "app", "dashboard", "users", "page.tsx"), "utf8");
  check("Serveuse UI hides checkout and discount behind canFinalizeSale", posPage.includes("props.canFinalizeSale ?") && posPage.includes("Envoyer la commande au caissier"));
  check("Held order clears customer, table and note for a new command", posPage.includes('setCustomerId("")') && posPage.includes('setOrderContextType("")') && posPage.includes('setTableNumber("")') && posPage.includes('setHeldSaleNote("")'));
  check("Temporary password generator uses Web Crypto", usersPage.includes("crypto.getRandomValues"));

  try {
    await users.ensureTenantRolePresets(tenant.id);
    const serveuseRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "SERVEUSE" }, include: { permissions: { include: { permission: true } } } });
    const caissierRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "CAISSIER" }, include: { permissions: { include: { permission: true } } } });
    const serveusePerms = (serveuseRole?.permissions ?? []).map((entry) => entry.permission.key);
    const caissierPerms = (caissierRole?.permissions ?? []).map((entry) => entry.permission.key);
    check("Restaurant has the SERVEUSE preset", Boolean(serveuseRole));
    check("Serveuse can sell but cannot finalize, discount or manage cash", serveusePerms.includes("pos.sell") && !serveusePerms.includes("pos.finalize") && !serveusePerms.includes("pos.discount") && !serveusePerms.some((key) => key.startsWith("cash.")));

    const serveusePassword = "Serveuse-Temp-2026";
    const caissierPassword = "Caissier-Temp-2026";
    const serveuse = await users.create(tenant.id, { name: "Marie Serveuse", email: `serveuse-${stamp}@example.test`, temporaryPassword: serveusePassword, role: "SERVEUSE" });
    const caissier = await users.create(tenant.id, { name: "Jean Caissier", email: `caissier-${stamp}@example.test`, temporaryPassword: caissierPassword, role: "CAISSIER" });
    const storedServeuse = await prisma.user.findUnique({ where: { id: serveuse.id } });
    const storedCaissier = await prisma.user.findUnique({ where: { id: caissier.id } });
    check("Serveuse temporary password is hashed and usable", storedServeuse?.password !== serveusePassword && await comparePassword(serveusePassword, storedServeuse.password));
    check("Caissier temporary password is hashed and usable", storedCaissier?.password !== caissierPassword && await comparePassword(caissierPassword, storedCaissier.password));
    check("New users are active", storedServeuse?.isActive === true && storedCaissier?.isActive === true);
    const serveuseLogin = await auth.login({ email: storedServeuse.email, password: serveusePassword, rememberMe: false });
    const caissierLogin = await auth.login({ email: storedCaissier.email, password: caissierPassword, rememberMe: false });
    check("Serveuse can log in with the temporary password", Boolean(serveuseLogin.accessToken) && serveuseLogin.user.role === "SERVEUSE");
    check("Caissier can log in with the temporary password", Boolean(caissierLogin.accessToken) && caissierLogin.user.role === "CAISSIER");

    const market = await prisma.tenant.create({ data: { name: `QA Market ${stamp}`, slug: `qa-market-${stamp}`, businessProfileType: "market", primaryActivity: "market", status: "TRIAL" } });
    await users.ensureTenantRolePresets(market.id);
    check("Market does not receive a SERVEUSE preset", !(await prisma.role.findFirst({ where: { tenantId: market.id, name: "SERVEUSE" } })));
    await prisma.tenant.delete({ where: { id: market.id } });

    const store = await prisma.store.create({ data: { tenantId: tenant.id, name: "Restaurant QA", code: `REST-${stamp}`, status: "ACTIVE" } });
    const warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, name: "Bar QA", code: `BAR-${stamp}` } });
    const cashRegister = await prisma.cashRegister.create({ data: { tenantId: tenant.id, storeId: store.id, name: "Caisse QA", code: `CAISSE-${stamp}` } });
    const cashSession = await prisma.cashSession.create({ data: { tenantId: tenant.id, cashRegisterId: cashRegister.id, openedById: caissier.id, status: "OPEN" } });
    const category = await prisma.category.create({ data: { tenantId: tenant.id, name: "Boissons QA", slug: `boissons-${stamp}` } });
    const product = await prisma.product.create({ data: { tenantId: tenant.id, categoryId: category.id, sku: `EAU-${stamp}`, name: "Eau QA", salePrice: 100, purchasePrice: 50, sellable: true, isActive: true } });
    await prisma.stock.create({ data: { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id, quantity: 10, minimumStock: 2 } });
    const customer = await prisma.customer.create({ data: { tenantId: tenant.id, customerCode: `CLI-${stamp}`, displayName: "Client Table QA", phone: "+50937000000" } });

    const serveuseRequest = { user: { id: serveuse.id, tenantId: tenant.id, sessionId: "serveuse-session", role: "SERVEUSE", roles: ["SERVEUSE"], permissions: serveusePerms } };
    const caissierRequest = { user: { id: caissier.id, tenantId: tenant.id, sessionId: "caissier-session", role: "CAISSIER", roles: ["CAISSIER"], permissions: caissierPerms } };
    await expectForbidden("Serveuse cannot apply a discount through the API", () => controller.calculateCart(serveuseRequest, { warehouseId: warehouse.id, discount: 10, items: [{ productId: product.id, quantity: 1 }] }));
    await expectForbidden("Serveuse cannot add a custom line through the API", () => controller.calculateCart(serveuseRequest, { warehouseId: warehouse.id, items: [{ customId: "custom-1", customName: "Travail libre", customType: "SERVICE", unitPrice: 100, quantity: 1 }] }));
    await expectForbidden("Serveuse cannot checkout directly", () => controller.checkout(serveuseRequest, { storeId: store.id, warehouseId: warehouse.id, cashSessionId: cashSession.id, items: [{ productId: product.id, quantity: 1 }], payments: [{ method: "CASH", amount: 100 }] }));

    const cart = await pos.calculateCart(tenant.id, { warehouseId: warehouse.id, items: [{ productId: product.id, quantity: 1 }] });
    const held = await controller.saveHeldSale(serveuseRequest, { cart, customerId: customer.id, storeId: store.id, warehouseId: warehouse.id, total: cart.total, note: "Table 5" });
    check("Serveuse creates one non-empty open order", Boolean(held.id) && cart.items.length === 1 && Number(cart.total) === 100);
    check("Serveuse sees her order exactly once", (await controller.heldSales(serveuseRequest)).items.filter((item) => item.id === held.id).length === 1);
    const otherServeuseRequest = { user: { ...serveuseRequest.user, id: "other-serveuse", sessionId: "other-session" } };
    check("Another Serveuse cannot see the order", !(await controller.heldSales(otherServeuseRequest)).items.some((item) => item.id === held.id));
    check("Caissier sees the Serveuse order", (await controller.heldSales(caissierRequest)).items.some((item) => item.id === held.id));

    await controller.claimHeldSale(caissierRequest, held.id);
    const salePayload = { storeId: store.id, warehouseId: warehouse.id, cashSessionId: cashSession.id, customerId: customer.id, items: [{ productId: product.id, quantity: 1 }], payments: [{ method: "CASH", amount: 100 }], note: "Table 5" };
    const key = `finalize-${stamp}`;
    const finalized = await controller.finalizeHeldSale(caissierRequest, held.id, { sale: salePayload, idempotencyKey: key });
    const repeated = await controller.finalizeHeldSale(caissierRequest, held.id, { sale: salePayload, idempotencyKey: key });
    const savedSale = await prisma.sale.findUnique({ where: { id: finalized.id }, include: { payments: true } });
    check("Finalization creates one sale only", finalized.id === repeated.id && await prisma.sale.count({ where: { tenantId: tenant.id } }) === 1);
    check("Sale creator remains the Serveuse", savedSale?.createdById === serveuse.id);
    check("Payment creator is the Caissier", savedSale?.payments.length === 1 && savedSale.payments[0].createdById === caissier.id);
    const stockAfter = await prisma.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id } } });
    check("Stock is decremented once", stockAfter?.quantity === 9);
    const receiptHtml = await printer.renderReceipt(tenant.id, finalized.id, "80");
    check("Receipt identifies Serveuse and Caissier", String(receiptHtml).includes("Marie Serveuse") && String(receiptHtml).includes("Jean Caissier"));
    await users.disable(tenant.id, serveuse.id, caissier.id);
    let disabledLoginBlocked = false;
    try { await auth.login({ email: storedServeuse.email, password: serveusePassword, rememberMe: false }); } catch (error) { disabledLoginBlocked = error?.status === 401 || error?.response?.statusCode === 401; }
    check("A disabled Serveuse cannot log in", disabledLoginBlocked);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  const passed = checks.filter((entry) => entry.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed`);
  if (passed !== checks.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

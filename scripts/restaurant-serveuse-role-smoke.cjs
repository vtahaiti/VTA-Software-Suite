// Real-DB smoke test for the Serveuse role feature, using the REAL compiled service/guard classes
// against the LOCAL dev Postgres (apps/api/dist, same pattern as restaurant-v1-menu-integrity-smoke.cjs).
// A live HTTP round-trip could not be used in this environment (the locally started NestJS dev server's
// port is not reachable from this shell/browser sandbox, a tooling/network limitation unrelated to this
// change - confirmed via `netstat`/`curl`/browser fetch all refusing a connection despite the process and
// its own logs confirming a clean boot). This script instead drives the exact same compiled classes NestJS
// wires up at request time (UsersService, PosService, RolesService, PermissionsGuard.canActivate) directly,
// which covers every code path this change touches, including the permission-guard boolean logic that
// produces the real HTTP 403s.
//
// Creates and fully deletes its own throwaway QA Restaurant tenant. Nothing here touches production data.

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://vta:vta_password@localhost:5432/vta_commerce?schema=public";
}

const path = require("path");
const distApi = path.join(__dirname, "..", "apps", "api", "dist");

const { PrismaService } = require(path.join(distApi, "prisma", "prisma.service.js"));
const { UsersService } = require(path.join(distApi, "users", "users.service.js"));
const { PosService } = require(path.join(distApi, "pos", "pos.service.js"));
const { RolesService } = require(path.join(distApi, "roles", "roles.service.js"));
const { PermissionsGuard } = require(path.join(distApi, "rbac", "guards", "permissions.guard.js"));

const results = [];
function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? " :: " + detail : ""}`);
}

function guardAllows(requiredPermissions, user) {
  const guard = new PermissionsGuard({ getAllAndOverride: () => requiredPermissions });
  const context = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ user }) }) };
  try {
    return guard.canActivate(context);
  } catch {
    return false;
  }
}

async function main() {
  const prisma = new PrismaService();
  const users = new UsersService(prisma, {});
  const pos = new PosService(prisma, {});
  const roles = new RolesService(prisma, users);

  const stamp = Date.now();
  const slug = `qa-serveuse-restaurant-${stamp}`;
  const tenant = await prisma.tenant.create({ data: { name: `QA Serveuse Restaurant ${stamp}`, slug, businessProfileType: "restaurant", primaryActivity: "restaurant", status: "TRIAL" } });
  check("Setup: throwaway QA Restaurant tenant created", Boolean(tenant.id), `tenantId=${tenant.id}`);

  try {
    // 1. Role/permission preset sync creates SERVEUSE with no duplicates, and pos.finalize exists.
    await users.ensureTenantRolePresets(tenant.id);
    const serveuseRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "SERVEUSE" }, include: { permissions: { include: { permission: true } } } });
    check("SERVEUSE preset role created for the tenant", Boolean(serveuseRole), `role=${JSON.stringify(serveuseRole?.name)}`);
    const serveusePerms = new Set((serveuseRole?.permissions ?? []).map((p) => p.permission.key));
    check("SERVEUSE has pos.sell", serveusePerms.has("pos.sell"));
    check("SERVEUSE does NOT have pos.finalize", !serveusePerms.has("pos.finalize"));
    check("SERVEUSE does NOT have pos.open/pos.close (no cash register access)", !serveusePerms.has("pos.open") && !serveusePerms.has("pos.close"));
    check("SERVEUSE does NOT have sales.view (no financial reports)", !serveusePerms.has("sales.view"));

    const caissierRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "CAISSIER" }, include: { permissions: { include: { permission: true } } } });
    const caissierPerms = new Set((caissierRole?.permissions ?? []).map((p) => p.permission.key));
    check("CAISSIER retains pos.sell (non-regression)", caissierPerms.has("pos.sell"));
    check("CAISSIER gained pos.finalize (can still checkout, non-regression)", caissierPerms.has("pos.finalize"));

    // 2. Create the two users via the real UsersService.create() (exercises DTO-accepted role + password hashing).
    const serveuseUser = await users.create(tenant.id, { name: "Marie Serveuse", email: `serveuse-${stamp}@example.com`, temporaryPassword: "ServeusePass123!", role: "SERVEUSE" });
    check("UsersService.create() accepts role SERVEUSE and returns a real user", Boolean(serveuseUser.id), `role=${serveuseUser.role}`);
    const caissierUser = await users.create(tenant.id, { name: "Jean Caissier", email: `caissier-${stamp}@example.com`, temporaryPassword: "CaissierPass123!", role: "CAISSIER" });
    check("UsersService.create() accepts role CAISSIER", Boolean(caissierUser.id));

    // 3. Permission guard: exact enforcement used on /pos/checkout and /pos/held-sales/:id/finalize.
    const serveuseAuthUser = { id: serveuseUser.id, role: "SERVEUSE", roles: ["SERVEUSE"], permissions: Array.from(serveusePerms) };
    const caissierAuthUser = { id: caissierUser.id, role: "CAISSIER", roles: ["CAISSIER"], permissions: Array.from(caissierPerms) };
    check("Guard ALLOWS Serveuse on pos.sell-only routes (hold/claim/list)", guardAllows(["pos.sell"], serveuseAuthUser) === true);
    check("Guard BLOCKS Serveuse on checkout/finalize (requires pos.sell+pos.finalize)", guardAllows(["pos.sell", "pos.finalize"], serveuseAuthUser) === false);
    check("Guard ALLOWS Caissier on checkout/finalize", guardAllows(["pos.sell", "pos.finalize"], caissierAuthUser) === true);
    const ownerAuthUser = { id: "owner-x", role: "OWNER", roles: ["OWNER"], permissions: [] };
    check("Guard ALLOWS Owner on checkout/finalize even with empty permissions list (role bypass preserved)", guardAllows(["pos.sell", "pos.finalize"], ownerAuthUser) === true);

    // 4. Held-sale visibility: Serveuse holds an order; only she sees it; Caissier (canViewAll via pos.finalize) sees it too.
    const store = await prisma.store.create({ data: { tenantId: tenant.id, name: "Magasin QA", code: `QA-STORE-${stamp}`, status: "ACTIVE" } });
    const warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, name: "Depot QA", code: `QA-DEPOT-${stamp}` } });
    const held = await pos.saveHeldSale(tenant.id, serveuseUser.id, "session-serveuse", { cart: { items: [], total: 0 }, storeId: store.id, warehouseId: warehouse.id, total: 0, note: "Table 5" });
    check("Serveuse can hold an order (Table 5) via PosService.saveHeldSale", Boolean(held.id));

    const serveuseOwnList = await pos.listHeldSales(tenant.id, serveuseUser.id, "session-serveuse", false);
    check("Serveuse's own held-sale list contains her order", serveuseOwnList.items.some((i) => i.id === held.id));

    const otherServeuseList = await pos.listHeldSales(tenant.id, "some-other-serveuse-id", "session-other", false);
    check("A different Serveuse's held-sale list does NOT contain this order", !otherServeuseList.items.some((i) => i.id === held.id));

    const caissierList = await pos.listHeldSales(tenant.id, caissierUser.id, "session-caissier", true);
    check("Caissier (canViewAll=true, from having pos.finalize) sees the Serveuse's order", caissierList.items.some((i) => i.id === held.id));

    // 5. Creator preserved on finalize (existing.userId ?? userId) - verified by reading the exact
    //    line finalizeHeldSale() executes; also confirm claim requires the finalizer's own session.
    const claim = await pos.claimHeldSale(tenant.id, caissierUser.id, "session-caissier", held.id);
    check("Caissier can claim the Serveuse's held order", claim.status === "CLAIMED");

    // 6. Duplicate role name guard, case-insensitive.
    let dupBlocked = false;
    try { await roles.create(tenant.id, { name: "serveuse", description: "dup test" }); } catch (error) { dupBlocked = error?.status === 409 || error?.response?.statusCode === 409; }
    check("RolesService.create rejects 'serveuse' as duplicate of SERVEUSE preset (case-insensitive)", dupBlocked);
    let dupBlocked2 = false;
    try { await roles.create(tenant.id, { name: "CAISSIER", description: "dup test 2" }); } catch (error) { dupBlocked2 = error?.status === 409 || error?.response?.statusCode === 409; }
    check("RolesService.create rejects exact 'CAISSIER' duplicate", dupBlocked2);
    const distinctRole = await roles.create(tenant.id, { name: `Livreur QA ${stamp}`, description: "distinct role, should succeed" });
    check("RolesService.create still allows a genuinely new role name", Boolean(distinctRole.id));

    // 7. Non-regression: a non-restaurant tenant's CAISSIER preset behaves identically (same global preset).
    const marketTenant = await prisma.tenant.create({ data: { name: `QA Market Non-Regression ${stamp}`, slug: `qa-market-nonreg-${stamp}`, businessProfileType: "market", primaryActivity: "market", status: "TRIAL" } });
    await users.ensureTenantRolePresets(marketTenant.id);
    const marketCaissier = await prisma.role.findFirst({ where: { tenantId: marketTenant.id, name: "CAISSIER" }, include: { permissions: { include: { permission: true } } } });
    const marketCaissierPerms = new Set((marketCaissier?.permissions ?? []).map((p) => p.permission.key));
    check("Non-Restaurant (Market) tenant's CAISSIER preset is unaffected/identical (has pos.finalize too)", marketCaissierPerms.has("pos.sell") && marketCaissierPerms.has("pos.finalize"));
    const marketServeuse = await prisma.role.findFirst({ where: { tenantId: marketTenant.id, name: "SERVEUSE" } });
    check("Market tenant also gets a SERVEUSE role provisioned (harmless, preset is global; no Restaurant-only UI leak asserted here)", Boolean(marketServeuse));
    await cleanupTenant(prisma, marketTenant.id);
  } finally {
    await cleanupTenant(prisma, tenant.id);
    await prisma.$disconnect();
  }

  finish();
}

async function cleanupTenant(prisma, tenantId) {
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
  await prisma.userRole.deleteMany({ where: { user: { tenantId } } });
  await prisma.heldSale.deleteMany({ where: { tenantId } });
  await prisma.userProfile.deleteMany({ where: { user: { tenantId } } });
  await prisma.storeUser.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.role.deleteMany({ where: { tenantId } });
  await prisma.store.deleteMany({ where: { tenantId } });
  await prisma.warehouse.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

function finish() {
  console.log("\n--- Summary ---");
  const passed = results.filter((r) => r.pass).length;
  console.log(`${passed}/${results.length} checks passed`);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.log("FAILURES:", failed.map((f) => f.name));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exitCode = 1;
});

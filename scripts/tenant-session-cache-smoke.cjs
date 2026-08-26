const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const auth = read("apps/web/lib/auth.ts");
const apiClient = read("apps/web/lib/api-client.ts");
const tenantAccess = read("apps/web/lib/tenant-access.ts");
const protectedShell = read("apps/web/components/protected-shell.tsx");
const authService = read("apps/api/src/auth/auth.service.ts");

assert(auth.includes("clearTenantScopedCaches"), "Auth must expose tenant-scoped cache clearing.");
assert(auth.includes("vta_pos_draft_"), "POS local drafts must be tenant-cache cleanup targets.");
assert(auth.includes("vta_pending_pos_print"), "Pending POS print cache must be cleanup target.");
assert(auth.includes("deleteDatabase(offlineDbName)"), "Offline IndexedDB cache must be cleared on tenant/session reset.");
assert(auth.includes("updateStoredUser"), "Auth must update user metadata without rewriting tokens.");

assert(apiClient.includes("isTenantAccessBlockedResponse(response)"), "API client must inspect explicit tenant blocking codes.");
assert(apiClient.includes("vta:tenant-access-blocked"), "Forbidden tenant responses must notify the shell.");
assert(apiClient.includes("response.status !== 401"), "Refresh retry must only run for 401, not 403.");
assert(tenantAccess.includes("response.status !== 403"), "Only 403 responses can represent blocked tenant access.");
assert(tenantAccess.includes("TENANT_PAUSED") && tenantAccess.includes("SUBSCRIPTION_INACTIVE"), "Tenant blocking codes must be explicit.");

assert(protectedShell.includes("TenantAccessBlocked"), "Protected shell must render a professional blocked account screen.");
assert(protectedShell.includes("clearTenantScopedCaches(\"tenant-blocked\")"), "Protected shell must purge tenant caches when access is blocked.");
assert(protectedShell.includes("updateStoredUser(sessionUser)"), "Protected shell must not overwrite refresh tokens while syncing /auth/me.");

assert(authService.includes('code: "TENANT_PAUSED"'), "Paused tenants must return an explicit blocking code.");
assert(authService.includes('code: "TENANT_SUSPENDED"'), "Suspended tenants must return an explicit blocking code.");
assert(authService.includes('code: "TENANT_EXPIRED"'), "Expired tenants must return an explicit blocking code.");

console.log("Tenant session cache smoke OK");

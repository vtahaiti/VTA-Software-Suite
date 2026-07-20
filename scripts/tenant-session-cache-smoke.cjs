const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const auth = read("apps/web/lib/auth.ts");
const apiClient = read("apps/web/lib/api-client.ts");
const protectedShell = read("apps/web/components/protected-shell.tsx");
const authService = read("apps/api/src/auth/auth.service.ts");

assert(auth.includes("clearTenantScopedCaches"), "Auth must expose tenant-scoped cache clearing.");
assert(auth.includes("vta_pos_draft_"), "POS local drafts must be tenant-cache cleanup targets.");
assert(auth.includes("vta_pending_pos_print"), "Pending POS print cache must be cleanup target.");
assert(auth.includes("deleteDatabase(offlineDbName)"), "Offline IndexedDB cache must be cleared on tenant/session reset.");
assert(auth.includes("updateStoredUser"), "Auth must update user metadata without rewriting tokens.");

assert(apiClient.includes("response.status === 403"), "API client must handle tenant lock/forbidden responses distinctly.");
assert(apiClient.includes("vta:tenant-access-blocked"), "Forbidden tenant responses must notify the shell.");
assert(apiClient.includes("response.status !== 401"), "Refresh retry must only run for 401, not 403.");

assert(protectedShell.includes("TenantAccessBlocked"), "Protected shell must render a professional blocked account screen.");
assert(protectedShell.includes("clearTenantScopedCaches(\"tenant-blocked\")"), "Protected shell must purge tenant caches when access is blocked.");
assert(protectedShell.includes("updateStoredUser(sessionUser)"), "Protected shell must not overwrite refresh tokens while syncing /auth/me.");

assert(authService.includes("ForbiddenException(\"Compte en pause"), "Paused tenants must return 403, not an auth-expiry 401.");
assert(authService.includes("ForbiddenException(\"Compte suspendu"), "Suspended tenants must return 403, not an auth-expiry 401.");
assert(authService.includes("ForbiddenException(\"Abonnement expiré"), "Expired tenants must return 403, not a silent broken session.");

console.log("Tenant session cache smoke OK");

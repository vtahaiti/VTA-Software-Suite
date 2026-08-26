const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const policy = read("apps/api/src/subscriptions/internal-tenant-policy.ts");
const auth = read("apps/api/src/auth/auth.service.ts");
const entitlements = read("apps/api/src/subscriptions/subscription-entitlements.service.ts");
const apiClient = read("apps/web/lib/api-client.ts");
const tenantAccess = read("apps/web/lib/tenant-access.ts");

assert.match(policy, /VTA_ENTERPRISE_TENANT_ID = "tenant_vta"/, "VTA Enterprise must use its reserved tenant ID.");
assert.match(auth, /if \(isVtaEnterpriseTenant\(tenantId\)\) return;/, "Billing status must not block VTA Enterprise authentication.");
assert.match(entitlements, /planCode: "INTERNAL"/, "VTA Enterprise must have an internal non-billable plan.");
assert.match(entitlements, /status: SubscriptionStatus\.ACTIVE/, "VTA Enterprise entitlements must always be active.");
assert.match(entitlements, /defaultFeatures\.map/, "VTA Enterprise must receive every subscription feature.");
assert.match(entitlements, /Number\.MAX_SAFE_INTEGER/, "VTA Enterprise subscription limits must not block usage.");
assert.match(auth, /code: "TENANT_PAUSED"/, "Paused access must use an explicit machine-readable code.");
assert.match(apiClient, /isTenantAccessBlockedResponse\(response\)/, "The Web must inspect the explicit tenant access code.");
assert.doesNotMatch(apiClient, /response\.status === 403/, "An ordinary permission 403 must not show the suspended account screen.");
assert.match(tenantAccess, /"SUBSCRIPTION_INACTIVE"/, "Inactive subscriptions must still show the blocked account screen.");

console.log("VTA Enterprise unlimited access smoke: OK");

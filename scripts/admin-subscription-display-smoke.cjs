const fs = require("fs");
const path = require("path");

const root = process.cwd();
const helper = fs.readFileSync(path.join(root, "apps/web/lib/admin-subscription-display.ts"), "utf8");
const tenantsPage = fs.readFileSync(path.join(root, "apps/web/app/admin/tenants/page.tsx"), "utf8");
const dashboardPage = fs.readFileSync(path.join(root, "apps/web/app/admin/page.tsx"), "utf8");
const subscriptionsPage = fs.readFileSync(path.join(root, "apps/web/app/admin/subscriptions/page.tsx"), "utf8");
const platformService = fs.readFileSync(path.join(root, "apps/api/src/platform/platform.service.ts"), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(helper.includes("getAdminSubscriptionDisplay"), "admin subscription display helper exists");
assert(helper.includes("isActivePaid ? \"ACTIVE\""), "active paid subscriptions override tenant TRIAL in display");
assert(helper.includes("\"EXPERT\"") && helper.includes("\"Expert\""), "Expert plan is labelled");
assert(helper.includes("\"STANDARD\"") && helper.includes("\"Professionnel\""), "Standard plan is labelled Professionnel");
assert(helper.includes("\"Paiement reçu\""), "payment received label is available");
assert(helper.includes("\"Essai en cours\""), "trial status label is available");

assert(tenantsPage.includes("Plan actif"), "companies table uses Plan actif label");
assert(tenantsPage.includes("Statut abonnement"), "companies table uses Statut abonnement label");
assert(tenantsPage.includes("Échéance"), "companies table uses Echeance label");
assert(tenantsPage.includes("getAdminSubscriptionDisplay"), "companies page uses central display helper");
assert(!tenantsPage.includes("<Status value={tenant.status} />"), "companies page does not show raw tenant status as subscription status");

assert(dashboardPage.includes("Statut abonnement"), "admin dashboard uses subscription status label");
assert(dashboardPage.includes("Paiement"), "admin dashboard shows payment label");
assert(dashboardPage.includes("getAdminSubscriptionDisplay"), "admin dashboard uses central display helper");

assert(subscriptionsPage.includes("Plan actif"), "subscriptions page keeps Plan actif label");
assert(subscriptionsPage.includes("Paiement reçu") || subscriptionsPage.includes("Paiement reçu"), "subscriptions page keeps payment received display");

assert(platformService.includes("isEffectivelyActiveTenant"), "platform stats use effective active tenant helper");
assert(platformService.includes("isEffectivelyTrialTenant"), "platform stats use effective trial tenant helper");
assert(platformService.includes("isActivePaidSubscription"), "active paid subscriptions are separated from trials in stats");

console.log("Admin subscription display smoke OK");

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = {
  schema: "database/prisma/schema.prisma",
  apiSchema: "apps/api/prisma/schema.prisma",
  features: "apps/api/src/subscriptions/subscription-features.ts",
  entitlements: "apps/api/src/subscriptions/subscription-entitlements.service.ts",
  guard: "apps/api/src/subscriptions/subscription-feature.guard.ts",
  controller: "apps/api/src/subscriptions/subscriptions.controller.ts",
  appModule: "apps/api/src/app.module.ts",
  onboarding: "apps/api/src/onboarding/onboarding.service.ts",
  navigation: "apps/web/lib/navigation.tsx",
  subscriptionPage: "apps/web/app/dashboard/settings/subscription/page.tsx",
  productsController: "apps/api/src/products/products.controller.ts",
  posController: "apps/api/src/pos/pos.controller.ts",
  reportsController: "apps/api/src/reports/reports.controller.ts"
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, relative]) => [key, read(relative)])
);

const failures = [];
const requiredPlans = ["ESSENTIAL", "STANDARD", "EXPERT"];
const requiredStatuses = ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "SUSPENDED", "CANCELED", "EXPIRED"];
const requiredFeatures = [
  "POS",
  "PRODUCTS",
  "CATEGORIES",
  "INVENTORY",
  "CUSTOMERS",
  "SUPPLIERS",
  "PURCHASES",
  "SALES_HISTORY",
  "HELD_SALES",
  "BASIC_REPORTS",
  "ADVANCED_REPORTS",
  "USERS",
  "ROLES_PERMISSIONS",
  "EMAIL_RECEIPTS",
  "QUOTES",
  "ORDERS",
  "MULTI_PAYMENT",
  "ADVANCED_TAXES",
  "MULTI_STORE",
  "MULTI_WAREHOUSE",
  "THERMAL_PRINTING",
  "LETTER_REPORT_PRINTING",
  "EXPERT_MODE"
];

for (const plan of requiredPlans) assertIncludes(source.schema, plan, `Plan ${plan} absent du schema Prisma principal.`);
for (const plan of requiredPlans) assertIncludes(source.apiSchema, plan, `Plan ${plan} absent du schema Prisma API.`);
for (const status of requiredStatuses) assertIncludes(source.schema, status, `Statut ${status} absent du schema Prisma.`);
for (const feature of requiredFeatures) assertIncludes(source.features, `"${feature}"`, `Feature ${feature} absente du catalogue.`);

for (const model of ["model Plan", "model Feature", "model PlanFeature", "model SubscriptionEvent", "model SubscriptionPayment"]) {
  assertIncludes(source.schema, model, `${model} absent du schema principal.`);
  assertIncludes(source.apiSchema, model, `${model} absent du schema API.`);
}

assertIncludes(source.entitlements, "assertFeature", "SubscriptionEntitlementsService doit exposer assertFeature.");
assertIncludes(source.entitlements, "assertSubscriptionActive", "SubscriptionEntitlementsService doit exposer assertSubscriptionActive.");
assertIncludes(source.entitlements, "FEATURE_NOT_INCLUDED", "Erreur FEATURE_NOT_INCLUDED absente.");
assertIncludes(source.entitlements, "SUBSCRIPTION_INACTIVE", "Erreur SUBSCRIPTION_INACTIVE absente.");
assertIncludes(source.guard, "Reflector", "Guard de feature non connecté au reflector.");
assertIncludes(source.controller, '@Get("me")', "Endpoint /subscription/me absent.");
assertIncludes(source.controller, '@Get("plans")', "Endpoint /subscription/plans absent.");
assertIncludes(source.appModule, "SubscriptionsModule", "SubscriptionsModule absent de AppModule.");
assertIncludes(source.onboarding, "createTrialSubscription", "Création entreprise ne crée pas la souscription d'essai.");
assertIncludes(source.navigation, "/dashboard/settings/subscription", "Route Abonnement absente de la navigation.");
assertIncludes(source.subscriptionPage, "/subscription/me", "Page Abonnement ne lit pas /subscription/me.");
assertIncludes(source.subscriptionPage, "/subscription/plans", "Page Abonnement ne lit pas /subscription/plans.");
assertIncludes(source.productsController, '@RequiresFeature("PRODUCTS")', "Produits non protégés par PRODUCTS.");
assertIncludes(source.productsController, '@RequiresFeature("CATEGORIES")', "Catégories non protégées par CATEGORIES.");
assertIncludes(source.posController, '@RequiresFeature("POS")', "POS non protégé par POS.");
assertIncludes(source.reportsController, '@RequiresFeature("BASIC_REPORTS")', "Rapports non protégés par BASIC_REPORTS.");
assertIncludes(source.reportsController, '@RequiresFeature("ADVANCED_REPORTS")', "Rapports avancés non protégés.");

if (failures.length) {
  console.error("Subscription entitlements smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Subscription entitlements smoke OK");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) failures.push(message);
}

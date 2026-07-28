const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const policy = read("apps/api/src/business-profiles/restaurant-warehouse-policy.ts");
const starter = read("apps/api/src/onboarding/restaurant-starter-catalog.ts");
const entitlements = read("apps/api/src/subscriptions/subscription-entitlements.service.ts");
const features = read("apps/api/src/subscriptions/subscription-features.ts");

for (const code of ["DEPOT-PRINCIPAL", "FRIGO", "BAR", "CUISINE", "FOURNITURES"]) {
  assert(policy.includes(`"${code}"`), `Code de zone Restaurant absent de la politique: ${code}`);
}

assert(starter.includes("RESTAURANT_SYSTEM_WAREHOUSE_CODES"), "Le catalogue Restaurant doit utiliser la politique centrale des zones système.");
assert(policy.includes('profile === "restaurant"'), "Le profil Restaurant doit bénéficier des zones système incluses.");
assert(policy.includes('profile === "hotel-restaurant"'), "Le profil Hôtel avec restaurant doit bénéficier des zones système incluses.");
assert(policy.includes('category.includes("restaurant")'), "Les anciens tenants Restaurant identifiés par leur catégorie doivent rester compatibles.");
assert(entitlements.includes("hasRestaurantStockZones"), "Le calcul d'usage doit reconnaître les profils avec zones Restaurant.");
assert(entitlements.includes("code: { notIn: [...RESTAURANT_SYSTEM_WAREHOUSE_CODES] }"), "Les zones Restaurant système ne doivent pas consommer le quota de dépôts.");
assert(entitlements.includes(": { tenantId, isActive: true };"), "Les autres profils doivent conserver le comptage normal de tous leurs dépôts actifs.");
assert(features.includes('STANDARD: { users: 5, stores: 2, warehouses: 2'), "La limite Professionnel globale ne doit pas être augmentée.");

console.log("Restaurant warehouse quota smoke OK");

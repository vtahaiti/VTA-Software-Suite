const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const profileService = read("apps/api/src/business-profiles/business-profiles.service.ts");
const catalog = read("apps/api/src/business-profiles/business-catalog.ts");
const navigation = read("apps/web/lib/navigation.tsx");
const hotelRoomsPage = read("apps/web/app/dashboard/hotel/rooms/page.tsx");
const posService = read("apps/api/src/pos/pos.service.ts");

assert(
  profileService.includes('{ label: "Réservations & Chambres", href: "/dashboard/hotel/rooms", module: "hotel" }'),
  "Le menu Hôtel doit exposer Réservations & Chambres avec la route réelle."
);
assert(
  navigation.includes('{ id: "hotel-rooms", label: "Réservations & Chambres", href: "/dashboard/hotel/rooms"'),
  "La navigation Web doit connaître la route Réservations & Chambres."
);
const hotelRestaurantMenu = profileService.match(/"hotel-restaurant":\s*\[[\s\S]*?\n\s*\],/)?.[0] ?? "";
assert(hotelRestaurantMenu.includes("/dashboard/hotel/rooms"), "Hotel avec restaurant doit afficher Reservations & Chambres.");
assert(hotelRestaurantMenu.includes("/dashboard/restaurant/stock"), "Hotel avec restaurant doit afficher Stock Restaurant.");
const hotelMenu = profileService.match(/hotel:\s*\[[\s\S]*?\n\s*\],/)?.[0] ?? "";
assert(!hotelMenu.includes("/dashboard/restaurant/stock"), "Hotel simple ne doit pas afficher Stock Restaurant.");

const hotelRestaurantProfile = catalog.match(/\{\s*slug:\s*"hotel-restaurant"[\s\S]*?\}/)?.[0] ?? "";
for (const moduleKey of ["pos", "products", "inventory", "customers", "reports", "settings", "hotel", "restaurant"]) {
  assert(hotelRestaurantProfile.includes(`"${moduleKey}"`), `Hôtel-restaurant doit conserver le module ${moduleKey}.`);
}
assert(hotelRestaurantProfile.includes('excludedModules: ["sales"]'), "Hôtel-restaurant ne doit pas réactiver Devis & Commandes.");
assert(
  navigation.includes('href === "/dashboard/payments" && sourceHrefs.has("/dashboard/pos")'),
  "Hôtel-restaurant doit conserver Paiements à partir de sa capacité POS."
);
assert(!hotelRoomsPage.includes("limit=500"), "La page Hôtel ne doit jamais utiliser une limite API invalide.");
for (const endpoint of ["products?limit=100", "customers?limit=100"]) {
  assert(hotelRoomsPage.includes(endpoint), `La page Hôtel doit charger ${endpoint}.`);
}
assert(
  hotelRoomsPage.includes("Impossible de charger") && hotelRoomsPage.includes("Vérifiez votre connexion puis réessayez."),
  "Les erreurs de chargement Hôtel doivent être visibles et compréhensibles."
);
assert(
  posService.includes('return profileType === "restaurant" || profileType === "hotel-restaurant";'),
  "Le POS Hôtel-restaurant doit appliquer le filtre sellable comme Restaurant."
);
assert(
  posService.includes("sellable: sellableOnly ? true : undefined"),
  "La recherche et le scan POS doivent filtrer les articles non vendables."
);

console.log("Hotel Restaurant smoke OK");

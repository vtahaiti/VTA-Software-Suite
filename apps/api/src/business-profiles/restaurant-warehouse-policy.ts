export const RESTAURANT_SYSTEM_WAREHOUSE_CODES = [
  "DEPOT-PRINCIPAL",
  "FRIGO",
  "BAR",
  "CUISINE",
  "FOURNITURES"
] as const;

export function hasRestaurantStockZones(profileType?: string | null, primaryActivity?: string | null, businessCategory?: string | null) {
  const profile = String(profileType ?? "").trim().toLowerCase();
  const activity = String(primaryActivity ?? "").trim().toLowerCase();
  const category = String(businessCategory ?? "").trim().toLowerCase();
  return profile === "restaurant"
    || profile === "hotel-restaurant"
    || category.includes("restaurant")
    || activity.includes("restaurant")
    || activity === "bar"
    || activity.includes("fast-food");
}

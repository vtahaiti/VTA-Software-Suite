export type PlanFeature = { key: string; name: string; enabled?: boolean };
export type BusinessEntitlements = { tenantId: string; planCode: string; planName: string; isActive: boolean; status: string; currentPeriodEnd?: string | null; trialEndsAt?: string | null; features: PlanFeature[]; limits: Record<string, number>; usage: Record<string, number> };
export type BusinessPlan = { code: string; name: string; description: string; monthlyPrice: number; currency: string; features: PlanFeature[]; limits: Record<string, number> };

// Specific routes precede their parent. Profile, company and billing remain
// accessible when a plan expires so a business can recover its subscription.
const routes: Array<[string, string]> = [
  ["/dashboard/settings/subscription", ""], ["/dashboard/profile", ""],
  ["/dashboard/settings/roles", "ROLES_PERMISSIONS"], ["/dashboard/settings/permissions", "ROLES_PERMISSIONS"],
  ["/dashboard/settings/import-export", "IMPORT_EXPORT"], ["/dashboard/settings/emails", "EMAIL_RECEIPTS"],
  ["/dashboard/settings/audit", "ADVANCED_AUDIT"], ["/dashboard/settings/notifications", "NOTIFICATIONS"],
  ["/dashboard/inventory/transfers", "STOCK_TRANSFERS"], ["/dashboard/inventory/alerts", "LOW_STOCK_ALERTS"],
  ["/dashboard/reports/top-products", "ADVANCED_REPORTS"],
  ["/dashboard/sales/orders", "ORDERS"], ["/dashboard/sales/quotes", "QUOTES"], ["/dashboard/sales/proformas", "ORDERS"],
  ["/dashboard/sales/in-progress", "HELD_SALES"], ["/dashboard/sales", "SALES_HISTORY"],
  ["/dashboard/products", "PRODUCTS"], ["/dashboard/inventory", "INVENTORY"],
  ["/dashboard/customers", "CUSTOMERS"], ["/dashboard/suppliers", "SUPPLIERS"],
  ["/dashboard/purchases", "PURCHASES"], ["/dashboard/reports", "BASIC_REPORTS"],
  ["/dashboard/users", "USERS"], ["/dashboard/roles", "ROLES_PERMISSIONS"],
  ["/dashboard/import-export", "IMPORT_EXPORT"], ["/dashboard/audit", "ADVANCED_AUDIT"],
  ["/dashboard/notifications", "NOTIFICATIONS"], ["/dashboard/audit-logs", "ADVANCED_AUDIT"],
  ["/dashboard/transfers", "STOCK_TRANSFERS"],
  ["/dashboard/pos", "POS"], ["/offline", "POS"]
];
export function requiredPlanFeature(href: string) {
  const path = href.split(/[?#]/)[0].replace(/\/$/, "");
  return routes.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"))?.[1] || null;
}
export function includesPlanFeature(value: BusinessEntitlements | null, key: string, now = Date.now()) {
  if (!value?.isActive) return false;
  const end = value.planCode === "POS_FREE" ? null : value.currentPeriodEnd || value.trialEndsAt;
  if (end && new Date(end).getTime() <= now) return false;
  return value.features.some(item => item.key === key && item.enabled !== false);
}
export function firstPlanForFeature(plans: BusinessPlan[], key: string) {
  return plans.filter(plan => plan.code.startsWith("POS_")).sort((a, b) => a.monthlyPrice - b.monthlyPrice).find(plan => plan.features.some(feature => feature.key === key && feature.enabled !== false));
}

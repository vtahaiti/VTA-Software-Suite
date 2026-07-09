import type { AuthUser } from "@/lib/auth";

const adminRoles = new Set(["OWNER", "Owner", "ADMIN", "Admin", "Administrator", "PlatformAdmin"]);

const routePermissions: Array<{ prefix: string; permissions: string[]; roles?: string[] }> = [
  { prefix: "/dashboard/pos", permissions: ["pos.sell", "sales.create"], roles: ["CAISSIER", "Cashier"] },
  { prefix: "/dashboard/sales", permissions: ["sales.view", "sales.read", "invoice.read"] },
  { prefix: "/dashboard/products", permissions: ["products.view"] },
  { prefix: "/dashboard/inventory", permissions: ["inventory.view"] },
  { prefix: "/dashboard/customers", permissions: ["customer.read", "customers.view"] },
  { prefix: "/dashboard/suppliers", permissions: ["suppliers.view"] },
  { prefix: "/dashboard/purchases", permissions: ["purchases.view"] },
  { prefix: "/dashboard/reports", permissions: ["reports.view", "reports.read"] },
  { prefix: "/dashboard/settings", permissions: ["settings.view", "settings.read"] },
  { prefix: "/dashboard/users", permissions: ["users.view", "roles.view"], roles: ["OWNER", "Owner", "ADMIN", "Admin", "Administrator"] }
];

export function isTenantAdmin(user: AuthUser | null) {
  if (!user) return false;
  return [user.role, ...(user.roles ?? [])].some((role) => adminRoles.has(role));
}

export function canAccessHref(user: AuthUser | null, href: string) {
  if (!user || isTenantAdmin(user)) return true;
  if (href === "/dashboard") return true;
  const permissions = new Set(user.permissions ?? []);
  const roles = new Set([user.role, ...(user.roles ?? [])].filter(Boolean));
  const rule = routePermissions.find((entry) => href.startsWith(entry.prefix));
  if (!rule) return false;
  if (rule.roles?.some((role) => roles.has(role))) return true;
  return rule.permissions.some((permission) => permissions.has(permission));
}

export function canManageUsers(user: AuthUser | null) {
  if (isTenantAdmin(user)) return true;
  const permissions = new Set(user?.permissions ?? []);
  return permissions.has("users.view") || permissions.has("users.create") || permissions.has("roles.view");
}

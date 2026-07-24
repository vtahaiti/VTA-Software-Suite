import type { AuthUser } from "@/lib/auth";

const adminRoles = new Set(["OWNER", "Owner", "ADMIN", "Admin", "Administrator", "PlatformAdmin"]);

const routePermissions: Array<{ prefix: string; permissions: string[]; roles?: string[]; exact?: boolean }> = [
  { prefix: "/dashboard/profile", permissions: ["dashboard.view"] },
  { prefix: "/dashboard/notifications", permissions: ["notifications.read"] },
  { prefix: "/dashboard/pos", permissions: ["pos.sell"], roles: ["CAISSIER", "Cashier"] },
  { prefix: "/dashboard/sales/in-progress", permissions: ["pos.sell"] },
  { prefix: "/dashboard/sales/completed", permissions: ["sales.view"] },
  { prefix: "/dashboard/sales/cancelled", permissions: ["sales.view"] },
  { prefix: "/dashboard/sales/quotes", permissions: ["quote.read"] },
  { prefix: "/dashboard/sales/proformas", permissions: ["proforma.read"] },
  { prefix: "/dashboard/sales/invoices", permissions: ["invoice.read"] },
  { prefix: "/dashboard/sales/returns", permissions: ["return.read"] },
  { prefix: "/dashboard/sales", permissions: ["quote.read", "proforma.read", "invoice.read", "return.read"], exact: true },
  { prefix: "/dashboard/products", permissions: ["products.view"] },
  { prefix: "/dashboard/inventory", permissions: ["inventory.view"] },
  { prefix: "/dashboard/customers", permissions: ["customer.read", "customers.view"] },
  { prefix: "/dashboard/suppliers", permissions: ["suppliers.view"] },
  { prefix: "/dashboard/purchases", permissions: ["purchases.view"] },
  { prefix: "/dashboard/reports", permissions: ["reports.view", "reports.read"] },
  { prefix: "/dashboard/settings", permissions: ["settings.view", "settings.read"] },
  { prefix: "/dashboard/users", permissions: ["users.view", "roles.view"], roles: ["OWNER", "Owner", "ADMIN", "Admin", "Administrator"] },
  { prefix: "/dashboard/payments", permissions: ["payment.read", "payment.create"] },
  { prefix: "/dashboard/cash-registers", permissions: ["cash.read", "cash.open", "cash.close"] },
  { prefix: "/dashboard/security", permissions: ["security.read", "settings.security.manage"] },
  { prefix: "/dashboard/audit", permissions: ["audit.read", "audit.export", "settings.audit.view"] },
  { prefix: "/dashboard/backups", permissions: ["backup.read", "backup.create"] }
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
  const rule = routePermissions
    .filter((entry) => entry.exact ? href === entry.prefix : href.startsWith(entry.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!rule) return false;
  if (rule.roles?.some((role) => roles.has(role))) return true;
  return rule.permissions.some((permission) => permissions.has(permission));
}

export function canManageUsers(user: AuthUser | null) {
  if (isTenantAdmin(user)) return true;
  const permissions = new Set(user?.permissions ?? []);
  return permissions.has("users.view") || permissions.has("users.create") || permissions.has("roles.view");
}

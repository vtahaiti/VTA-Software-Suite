import { defaultPermissions } from "../rbac/default-permissions";
import type { TenantRoleName } from "./dto/create-user.dto";

const allPermissions = defaultPermissions.map((permission) => permission.key);
const byPrefix = (...prefixes: string[]) => allPermissions.filter((permission) => prefixes.some((prefix) => permission.startsWith(prefix)));

export const tenantRolePresets: Record<TenantRoleName, { description: string; permissions: string[] }> = {
  OWNER: { description: "Proprietaire, acces total a l'entreprise.", permissions: allPermissions },
  ADMIN: {
    description: "Administrateur, acces presque total aux operations.",
    permissions: allPermissions.filter((permission) => !permission.startsWith("tenants.") && !permission.startsWith("backup."))
  },
  CAISSIER: {
    description: "Caisse et ventes simples.",
    permissions: ["dashboard.view", "pos.sell", "pos.open", "pos.close", "sales.view", "sales.create", "invoice.read", "invoice.print", "payment.create", "customer.read", "customer.create", "products.view"]
  },
  STOCK: {
    description: "Produits, stock, fournisseurs et achats.",
    permissions: ["dashboard.view", ...byPrefix("products.", "inventory.", "suppliers.", "purchases.", "warehouse.", "store.", "transfer.")]
  },
  COMPTABLE: {
    description: "Ventes, achats, factures, paiements et rapports.",
    permissions: ["dashboard.view", ...byPrefix("sales.", "invoice.", "invoices.", "payment.", "purchases.", "reports.", "accounting.")]
  },
  MANAGER: {
    description: "Gestion quotidienne sans parametres critiques.",
    permissions: ["dashboard.view", ...byPrefix("products.", "sales.", "customer.", "customers.", "reports."), "pos.sell", "pos.open", "payment.create"]
  }
};

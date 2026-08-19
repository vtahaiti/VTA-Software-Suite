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
  // "business.read" est ajoute a chaque preset non-admin ci-dessous : GET /business-profiles/tenant
  // (business-profiles.controller.ts) l'exige, et cette route sert la configuration du menu/modules
  // affiches au tableau de bord. Aucun preset autre que OWNER/ADMIN (via allPermissions) ne l'avait -
  // un manager, caissier, etc. se retrouvait donc avec un menu completement vide malgre "dashboard.view".
  // Bug reel constate en production le 2026-08-19, preexistant a ce soir (pas lie aux modifications
  // recentes de ce fichier).
  CAISSIER: {
    description: "Caisse et ventes simples.",
    permissions: ["dashboard.view", "business.read", "notifications.read", "notifications.update", "pos.sell", "pos.finalize", "pos.open", "pos.close", "sales.view", "invoice.print", "customer.read", "customer.create", "cash.read", "cash.open", "cash.close", "cash.report"]
  },
  SERVEUSE: {
    description: "Prise de commande en salle : POS et commandes en attente uniquement, sans encaissement ni acces a la caisse.",
    permissions: ["dashboard.view", "business.read", "notifications.read", "notifications.update", "pos.sell", "customer.read", "customer.create"]
  },
  STOCK: {
    description: "Produits, stock, fournisseurs et achats.",
    permissions: ["dashboard.view", "business.read", ...byPrefix("products.", "inventory.", "suppliers.", "purchases.", "warehouse.", "store.", "transfer.")]
  },
  COMPTABLE: {
    description: "Ventes, achats, factures, paiements et rapports.",
    permissions: ["dashboard.view", "business.read", ...byPrefix("sales.", "invoice.", "invoices.", "payment.", "purchases.", "reports.", "accounting.")]
  },
  MANAGER: {
    description: "Gestion quotidienne sans parametres critiques.",
    permissions: [
      "dashboard.view",
      "business.read",
      "notifications.read",
      "notifications.update",
      ...byPrefix("products.", "inventory.", "suppliers.", "purchases.", "sales.", "quote.", "proforma.", "invoice.", "invoices.", "payment.", "customer.", "customers.", "reports.", "warehouse.", "store.", "transfer.", "cash."),
      "pos.sell",
      "pos.finalize",
      "pos.open",
      "pos.close"
    ]
  },
  OBSERVATEUR: {
    description: "Lecture seule, rapports et consultation sans operations.",
    permissions: ["dashboard.view", "business.read", "notifications.read", "notifications.update", ...byPrefix("reports.")]
  },
  BASIC: {
    description: "Acces minimal au profil et aux notifications.",
    permissions: ["dashboard.view", "business.read", "notifications.read", "notifications.update"]
  }
};

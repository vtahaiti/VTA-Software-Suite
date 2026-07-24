import type { AuthUser } from "@/lib/auth";
import { canAccessHref, canManageUsers } from "@/lib/role-access";
import type { BusinessMenuSection } from "@/lib/business-profiles";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  CreditCard,
  FileClock,
  History,
  Home,
  Layers,
  LogOut,
  Mail,
  Package,
  PackageOpen,
  PlusCircle,
  Printer,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon
} from "lucide-react";

export type NavigationChild = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavigationItem = NavigationChild & {
  children?: NavigationChild[];
};

export type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

export const navigationIcons = {
  Accueil: Home,
  Ventes: ShoppingCart,
  NouvelleVente: PlusCircle,
  VentesAttente: Clock3,
  Historique: History,
  Paiements: CreditCard,
  Catalogue: Package,
  Produits: PackageOpen,
  Categories: Tags,
  Stock: Boxes,
  Inventaire: Boxes,
  Entrepots: Warehouse,
  Transferts: Truck,
  Mouvements: FileClock,
  Clients: Users,
  Fournisseurs: Truck,
  Achats: ShoppingBag,
  Rapports: BarChart3,
  Utilisateurs: UserCog,
  RolesPermissions: ShieldCheck,
  Parametres: Settings,
  Entreprise: Building2,
  Modules: Layers,
  Emails: Mail,
  PosSettings: Printer,
  Facturation: CreditCard,
  Abonnement: CreditCard,
  Securite: ShieldAlert,
  Audit: FileClock,
  Profil: CircleUserRound,
  Notifications: Bell,
  Deconnexion: LogOut,
  Chevron: ChevronDown
} as const;

const routeOrder: NavigationSection[] = [
  {
    title: "Principal",
    items: [
      { id: "home", label: "Accueil", href: "/dashboard", icon: navigationIcons.Accueil },
      { id: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: navigationIcons.Notifications }
    ]
  },
  {
    title: "Ventes",
    items: [
      {
        id: "sales",
        label: "Ventes",
        href: "/dashboard/pos",
        icon: navigationIcons.Ventes,
        children: [
          { id: "new-sale", label: "Nouvelle vente", href: "/dashboard/pos", icon: navigationIcons.NouvelleVente },
          { id: "quotes-orders", label: "Devis & Commandes", href: "/dashboard/sales", icon: navigationIcons.Facturation },
          { id: "pending-sales", label: "Ventes en attente / Commandes ouvertes", href: "/dashboard/sales/in-progress", icon: navigationIcons.VentesAttente },
          { id: "sales-history", label: "Historique", href: "/dashboard/sales/completed", icon: navigationIcons.Historique },
          { id: "payments", label: "Paiements", href: "/dashboard/payments", icon: navigationIcons.Paiements }
        ]
      }
    ]
  },
  {
    title: "Catalogue",
    items: [
      {
        id: "catalog",
        label: "Catalogue",
        href: "/dashboard/products",
        icon: navigationIcons.Catalogue,
        children: [
          { id: "products", label: "Produits", href: "/dashboard/products", icon: navigationIcons.Produits },
          { id: "categories", label: "Catégories", href: "/dashboard/products/categories", icon: navigationIcons.Categories }
        ]
      }
    ]
  },
  {
    title: "Stock",
    items: [
      {
        id: "stock",
        label: "Stock",
        href: "/dashboard/inventory",
        icon: navigationIcons.Stock,
        children: [
          { id: "inventory", label: "Inventaire", href: "/dashboard/inventory", icon: navigationIcons.Inventaire },
          { id: "warehouses", label: "Entrepôts", href: "/dashboard/inventory/warehouses", icon: navigationIcons.Entrepots },
          { id: "transfers", label: "Transferts", href: "/dashboard/inventory/transfers", icon: navigationIcons.Transferts },
          { id: "movements", label: "Journal des mouvements", href: "/dashboard/inventory/movements", icon: navigationIcons.Mouvements }
        ]
      },
      {
        id: "purchases",
        label: "Achats",
        href: "/dashboard/purchases",
        icon: navigationIcons.Achats,
        children: [
          { id: "purchase-orders", label: "Achats", href: "/dashboard/purchases", icon: navigationIcons.Achats },
          { id: "suppliers", label: "Fournisseurs", href: "/dashboard/suppliers", icon: navigationIcons.Fournisseurs }
        ]
      },
      { id: "reports", label: "Rapports", href: "/dashboard/reports", icon: navigationIcons.Rapports }
    ]
  },
  {
    title: "Administration",
    items: [
      { id: "customers", label: "Clients", href: "/dashboard/customers", icon: navigationIcons.Clients },
      { id: "users", label: "Rôles & Utilisateurs", href: "/dashboard/users", icon: navigationIcons.Utilisateurs },
      {
        id: "settings",
        label: "Paramètres",
        href: "/dashboard/settings/company",
        icon: navigationIcons.Parametres,
        children: [
          { id: "company-settings", label: "Entreprise", href: "/dashboard/settings/company", icon: navigationIcons.Entreprise },
          { id: "business-modules-settings", label: "Activité / modules", href: "/dashboard/settings/business-modules", icon: navigationIcons.Modules },
          { id: "invoicing-settings", label: "Facturation", href: "/dashboard/settings/invoicing", icon: navigationIcons.Facturation },
          { id: "pos-settings", label: "Impression", href: "/dashboard/settings/pos", icon: navigationIcons.PosSettings },
          { id: "security", label: "Sécurité", href: "/dashboard/security", icon: navigationIcons.Securite },
          { id: "audit", label: "Journal d'audit", href: "/dashboard/audit", icon: navigationIcons.Audit },
          { id: "subscription-settings", label: "Abonnement", href: "/dashboard/settings/subscription", icon: navigationIcons.Abonnement },
          { id: "email-settings", label: "Emails", href: "/dashboard/settings/emails", icon: navigationIcons.Emails }
        ]
      }
    ]
  }
];

export function buildNavigation(user: AuthUser | null, sourceSections: BusinessMenuSection[] = []): NavigationSection[] {
  const sourceHrefs = new Set(sourceSections.flatMap((section) => section.items.map((item) => item.href)));
  const sourceLabels = new Map(sourceSections.flatMap((section) => section.items.map((item) => [item.href, item.label] as const)));
  const allowBySource = sourceHrefs.size === 0;

  return routeOrder
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => filterNavigationItem(item, user, sourceHrefs, sourceLabels, allowBySource))
        .filter((item): item is NavigationItem => Boolean(item))
    }))
    .filter((section) => section.items.length > 0);
}

function filterNavigationItem(item: NavigationItem, user: AuthUser | null, sourceHrefs: Set<string>, sourceLabels: Map<string, string>, allowBySource: boolean): NavigationItem | null {
  if (item.href === "/dashboard/users" && !canManageUsers(user)) return null;
  const children = item.children
    ?.filter((child) => isKnownOrSource(child.href, sourceHrefs, allowBySource))
    .filter((child) => canAccessHref(user, child.href))
    .map((child) => ({ ...child, label: sourceLabels.get(child.href) ?? child.label }));

  const selfAllowed = isKnownOrSource(item.href, sourceHrefs, allowBySource) && canAccessHref(user, item.href);
  if (!selfAllowed && (!children || children.length === 0)) return null;
  return { ...item, label: children?.length ? item.label : sourceLabels.get(item.href) ?? item.label, children };
}

function isKnownOrSource(href: string, sourceHrefs: Set<string>, allowBySource: boolean) {
  if (allowBySource) return true;
  if (href === "/dashboard" || href === "/dashboard/users") return true;
  if (sourceHrefs.has(href)) return true;
  if (href === "/dashboard/sales/in-progress" && sourceHrefs.has("/dashboard/pos")) return true;
  if (href === "/dashboard/sales/completed" && sourceHrefs.has("/dashboard/pos")) return true;
  if (href === "/dashboard/products/categories" && sourceHrefs.has("/dashboard/products")) return true;
  if (href === "/dashboard/settings/emails" && sourceHrefs.has("/dashboard/settings/company")) return true;
  if (href === "/dashboard/settings/pos" && sourceHrefs.has("/dashboard/settings/company")) return true;
  if (href === "/dashboard/settings/invoicing" && sourceHrefs.has("/dashboard/settings/company")) return true;
  if (href === "/dashboard/settings/subscription" && sourceHrefs.has("/dashboard/settings/company")) return true;
  if (href === "/dashboard/settings/business-modules" && sourceHrefs.has("/dashboard/settings/company")) return true;
  if (href === "/dashboard/security" && sourceHrefs.has("/dashboard/settings/company")) return true;
  if (href === "/dashboard/audit" && sourceHrefs.has("/dashboard/settings/company")) return true;
  if (href === "/dashboard/inventory/warehouses" && sourceHrefs.has("/dashboard/inventory")) return true;
  if (href === "/dashboard/inventory/transfers" && sourceHrefs.has("/dashboard/inventory")) return true;
  if (href === "/dashboard/inventory/movements" && sourceHrefs.has("/dashboard/inventory")) return true;
  if (href === "/dashboard/payments" && sourceHrefs.has("/dashboard/pos")) return true;
  return false;
}

export function isNavigationItemActive(pathname: string, item: NavigationItem | NavigationChild) {
  if (pathname === item.href) return true;
  if ("children" in item && item.children?.some((child) => isNavigationItemActive(pathname, child))) return true;
  if (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)) return true;
  return false;
}

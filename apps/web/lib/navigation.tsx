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
  History,
  Home,
  LogOut,
  Mail,
  Package,
  PackageOpen,
  Palette,
  PlusCircle,
  Printer,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  Users,
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
  Catalogue: Package,
  Produits: PackageOpen,
  Categories: Tags,
  Inventaire: Boxes,
  Clients: Users,
  Fournisseurs: Truck,
  Achats: ShoppingBag,
  Rapports: BarChart3,
  Utilisateurs: UserCog,
  RolesPermissions: ShieldCheck,
  Parametres: Settings,
  Entreprise: Building2,
  Apparence: Palette,
  Emails: Mail,
  Impression: Printer,
  Abonnement: CreditCard,
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
      {
        id: "sales",
        label: "Ventes",
        href: "/dashboard/pos",
        icon: navigationIcons.Ventes,
        children: [
          { id: "new-sale", label: "Nouvelle vente", href: "/dashboard/pos", icon: navigationIcons.NouvelleVente },
          { id: "pending-sales", label: "Ventes en attente", href: "/dashboard/sales/in-progress", icon: navigationIcons.VentesAttente },
          { id: "sales-history", label: "Historique des ventes", href: "/dashboard/sales/completed", icon: navigationIcons.Historique }
        ]
      }
    ]
  },
  {
    title: "Commerce",
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
      },
      { id: "inventory", label: "Inventaire", href: "/dashboard/inventory", icon: navigationIcons.Inventaire },
      { id: "customers", label: "Clients", href: "/dashboard/customers", icon: navigationIcons.Clients },
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
      { id: "users", label: "Rôles & Utilisateurs", href: "/dashboard/users", icon: navigationIcons.Utilisateurs },
      {
        id: "settings",
        label: "Paramètres",
        href: "/dashboard/settings/company",
        icon: navigationIcons.Parametres,
        children: [
          { id: "company-settings", label: "Entreprise", href: "/dashboard/settings/company", icon: navigationIcons.Entreprise },
          { id: "appearance-settings", label: "Apparence", href: "/dashboard/settings/business-modules", icon: navigationIcons.Apparence },
          { id: "email-settings", label: "Emails", href: "/dashboard/settings/emails", icon: navigationIcons.Emails },
          { id: "print-settings", label: "Impression", href: "/dashboard/settings/pos", icon: navigationIcons.Impression },
          { id: "role-settings", label: "Rôles et permissions", href: "/dashboard/settings/roles", icon: navigationIcons.RolesPermissions }
        ]
      }
    ]
  }
];

export function buildNavigation(user: AuthUser | null, sourceSections: BusinessMenuSection[] = []): NavigationSection[] {
  const sourceHrefs = new Set(sourceSections.flatMap((section) => section.items.map((item) => item.href)));
  const allowBySource = sourceHrefs.size === 0;

  return routeOrder
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => filterNavigationItem(item, user, sourceHrefs, allowBySource))
        .filter((item): item is NavigationItem => Boolean(item))
    }))
    .filter((section) => section.items.length > 0);
}

function filterNavigationItem(item: NavigationItem, user: AuthUser | null, sourceHrefs: Set<string>, allowBySource: boolean): NavigationItem | null {
  if (item.href === "/dashboard/users" && !canManageUsers(user)) return null;
  const children = item.children
    ?.filter((child) => isKnownOrSource(child.href, sourceHrefs, allowBySource))
    .filter((child) => canAccessHref(user, child.href));

  const selfAllowed = isKnownOrSource(item.href, sourceHrefs, allowBySource) && canAccessHref(user, item.href);
  if (!selfAllowed && (!children || children.length === 0)) return null;
  return { ...item, children };
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
  if (href === "/dashboard/settings/business-modules" && sourceHrefs.has("/dashboard/settings/company")) return true;
  if (href === "/dashboard/settings/roles" && sourceHrefs.has("/dashboard/settings/company")) return true;
  return false;
}

export function isNavigationItemActive(pathname: string, item: NavigationItem | NavigationChild) {
  if (pathname === item.href) return true;
  if ("children" in item && item.children?.some((child) => isNavigationItemActive(pathname, child))) return true;
  if (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)) return true;
  return false;
}

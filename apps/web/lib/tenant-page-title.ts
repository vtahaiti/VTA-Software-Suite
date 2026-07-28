type TenantPageTitleContext = {
  companyName?: string | null;
  businessProfileType?: string | null;
};

const routeTitles: Array<{ match: (pathname: string) => boolean; label: string }> = [
  { match: (pathname) => pathname.startsWith("/dashboard/sales/in-progress"), label: "Ventes en attente" },
  { match: (pathname) => pathname.startsWith("/dashboard/sales/completed"), label: "Historique des ventes" },
  { match: (pathname) => pathname.startsWith("/dashboard/restaurant/stock"), label: "Stock" },
  { match: (pathname) => pathname.startsWith("/dashboard/inventory"), label: "Stock" },
  { match: (pathname) => pathname.startsWith("/dashboard/products"), label: "Produits" },
  { match: (pathname) => pathname.startsWith("/dashboard/customers"), label: "Clients" },
  { match: (pathname) => pathname.startsWith("/dashboard/reports"), label: "Rapports" },
  { match: (pathname) => pathname.startsWith("/dashboard/settings"), label: "Paramètres" },
  { match: (pathname) => pathname.startsWith("/dashboard/users"), label: "Rôles & Utilisateurs" },
  { match: (pathname) => pathname.startsWith("/dashboard/notifications"), label: "Notifications" },
  { match: (pathname) => pathname.startsWith("/dashboard/profile"), label: "Profil" },
  { match: (pathname) => pathname.startsWith("/dashboard/purchases"), label: "Achats" },
  { match: (pathname) => pathname.startsWith("/dashboard/suppliers"), label: "Fournisseurs" },
  { match: (pathname) => pathname.startsWith("/dashboard/sales"), label: "Devis & Commandes" }
];

export function tenantPageTitle(pathname: string, context: TenantPageTitleContext = {}) {
  const companyName = context.companyName?.trim() || "Mon entreprise";
  if (pathname === "/dashboard") return `${companyName} | VTA Business`;
  if (pathname.startsWith("/dashboard/pos")) {
    const profile = context.businessProfileType?.toLowerCase();
    const label = profile === "restaurant" || profile === "hotel-restaurant" ? "Nouvelle commande" : "Nouvelle vente";
    return `${label} - ${companyName}`;
  }
  const route = routeTitles.find((candidate) => candidate.match(pathname));
  return `${route?.label ?? "Espace entreprise"} - ${companyName}`;
}

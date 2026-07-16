"use client";
import { useEffect, useState } from "react";
import { getTenantBusinessConfiguration, type TenantBusinessConfiguration } from "@/lib/business-profiles";

const widgetRoutes: Record<string, string> = {
  "sales-today": "/dashboard/pos",
  products: "/dashboard/products",
  "low-stock": "/dashboard/inventory",
  customers: "/dashboard/customers",
  invoices: "/dashboard/sales/invoices",
  revenue: "/dashboard/reports",
  "pending-purchases": "/dashboard/purchases",
  "restaurant-tables": "/dashboard/pos",
  "restaurant-pos": "/dashboard/pos",
  "restaurant-menu": "/dashboard/products",
  kitchen: "/dashboard/pos",
  repairs: "/dashboard/sales/invoices",
  appointments: "/dashboard/customers",
  production: "/dashboard/sales/quotes",
  measurements: "/dashboard/products",
  rooms: "/dashboard/customers"
};

const activityCards: Record<string, Array<{ label: string; description: string; href: string }>> = {
  commerce: [
    { label: "Nouvelle vente", description: "Encaisser rapidement au point de vente.", href: "/dashboard/pos" },
    { label: "Produits", description: "Gerer le catalogue et les prix.", href: "/dashboard/products" },
    { label: "Stock", description: "Surveiller les quantites disponibles.", href: "/dashboard/inventory" },
    { label: "Clients", description: "Retrouver les clients et soldes.", href: "/dashboard/customers" },
    { label: "Ventes du jour", description: "Voir la performance du jour.", href: "/dashboard/reports" }
  ],
  restaurant: [
    { label: "Nouvelle commande", description: "Demarrer une commande au POS.", href: "/dashboard/pos" },
    { label: "Produits / menu", description: "Gerer plats, boissons et menus.", href: "/dashboard/products" },
    { label: "Ventes en attente", description: "Reprendre une commande en attente.", href: "/dashboard/sales/in-progress" },
    { label: "Ventes du jour", description: "Suivre les ventes restaurant.", href: "/dashboard/reports" }
  ],
  hotel: [
    { label: "Chambres", description: "Gestion des chambres preparee.", href: "/dashboard/stores" },
    { label: "Reservations", description: "Suivi des reservations prepare.", href: "/dashboard/customers" },
    { label: "Check-in", description: "Accueil client prepare.", href: "/dashboard/customers" },
    { label: "Clients", description: "Fichier clients hotel.", href: "/dashboard/customers" }
  ],
  school: [
    { label: "Eleves", description: "Base eleves preparee.", href: "/dashboard/customers" },
    { label: "Paiements", description: "Suivi des paiements scolaires.", href: "/dashboard/payments" },
    { label: "Classes", description: "Organisation des classes preparee.", href: "/dashboard/customers" },
    { label: "Rapports", description: "Rapports scolaires et financiers.", href: "/dashboard/reports" }
  ],
  manufacturing: [
    { label: "Production", description: "Commandes et fabrication preparees.", href: "/dashboard/sales/quotes" },
    { label: "Matieres premieres", description: "Suivi des matieres en stock.", href: "/dashboard/inventory" },
    { label: "Commandes", description: "Demandes clients et devis.", href: "/dashboard/sales" },
    { label: "Stock", description: "Stock produits finis et composants.", href: "/dashboard/inventory" }
  ],
  printing: [
    { label: "Commandes", description: "Commandes clients impression.", href: "/dashboard/sales/quotes" },
    { label: "Production", description: "Suivi de production prepare.", href: "/dashboard/sales/quotes" },
    { label: "DTF / Broderie / Laser", description: "Ateliers specialises regroupés.", href: "/dashboard/sales/quotes" },
    { label: "Delais", description: "Suivi des delais prepare.", href: "/dashboard/reports" }
  ],
  garage: [
    { label: "Vehicules", description: "Fiches vehicules preparees.", href: "/dashboard/customers" },
    { label: "Reparations", description: "Suivi reparations et factures.", href: "/dashboard/sales/invoices" },
    { label: "Rendez-vous", description: "Planning prepare.", href: "/dashboard/customers" },
    { label: "Pieces", description: "Stock pieces et produits.", href: "/dashboard/products" }
  ],
  multi: [
    { label: "Nouvelle vente", description: "Action principale de vente.", href: "/dashboard/pos" },
    { label: "Produits", description: "Catalogue centralise.", href: "/dashboard/products" },
    { label: "Stock", description: "Stock global et magasins.", href: "/dashboard/inventory" },
    { label: "Paramètres", description: "Activer plus de modules plus tard.", href: "/dashboard/settings/business-modules" }
  ]
};

function activityGroup(configuration: TenantBusinessConfiguration) {
  const profile = configuration.businessProfileType ?? "commerce";
  if (["restaurant"].includes(profile)) return "restaurant";
  if (["hotel"].includes(profile)) return "hotel";
  if (["school"].includes(profile)) return "school";
  if (["manufacturing", "windows-aluminium"].includes(profile)) return "manufacturing";
  if (["printing"].includes(profile)) return "printing";
  if (["garage"].includes(profile)) return "garage";
  if (["multi-activities"].includes(profile)) return "multi";
  return "commerce";
}

export function AdaptiveDashboard() {
  const [configuration, setConfiguration] = useState<TenantBusinessConfiguration | null>(null);

  useEffect(() => {
    getTenantBusinessConfiguration().then(setConfiguration).catch(() => undefined);
  }, []);

  if (!configuration) return null;
  const activeProfiles = configuration.profiles.filter((profile) => profile.isActive !== false);
  const widgets = configuration.widgets.slice(0, 8);
  const cards = activityCards[activityGroup(configuration)] ?? activityCards.commerce;

  return <div className="mt-6 space-y-5"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-medium text-brand-600">Dashboard adapte</p><h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{configuration.primaryActivity ?? "Activité principale"}</h2><p className="mt-1 text-sm text-slate-500">Les raccourcis restent simples et suivent l&apos;activité choisie pendant la creation de l&apos;entreprise.</p></div><div className="flex flex-wrap gap-2">{activeProfiles.map((profile)=><span key={profile.slug} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-200">{profile.name}</span>)}</div></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((card)=><a key={card.label} href={card.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-bold text-slate-950 dark:text-white">{card.label}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p></a>)}</div>{widgets.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{widgets.map((widget)=><a key={widget.key} href={widgetRoutes[widget.key] ?? "/dashboard"} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{widget.module}</p><h3 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{widget.label}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{widget.description}</p></a>)}</div> : null}</div>;
}

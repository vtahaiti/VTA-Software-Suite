"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardSummaryCards } from "./dashboard-summary-cards";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { getTenantBusinessConfiguration, type TenantBusinessConfiguration } from "@/lib/business-profiles";
import { CompanyBranding, getCompanyBranding } from "@/lib/company-branding";

type DashboardCard = { label: string; href: string; description: string };
type DashboardTemplate = {
  profile: string;
  action: string;
  actionHref: string;
  description: string;
  cards: DashboardCard[];
};

export default function DashboardPage() {
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [business, setBusiness] = useState<TenantBusinessConfiguration | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (token) void getCompanyBranding(token).then(setBranding).catch(() => undefined);
    void getTenantBusinessConfiguration().then(setBusiness).catch(() => undefined);
  }, []);

  const currentUser = getCurrentUser();
  const companyName = branding?.companyName ?? currentUser?.tenant ?? "Mon entreprise";
  const primaryColor = branding?.primaryColor ?? "#2563eb";
  const dashboardTemplate = getDashboardTemplate(business?.businessProfileType, business?.primaryActivity);
  const showCommerceSummary = dashboardTemplate.profile === "commerce";

  return (
    <div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={`Logo ${companyName}`} className="h-16 w-16 rounded-xl object-cover shadow-sm" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm" style={{ backgroundColor: primaryColor }}>{branding?.companyInitials ?? "ME"}</div>
            )}
            <div>
              <p className="text-sm font-medium" style={{ color: primaryColor }}>Accueil</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Bienvenue chez {companyName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{dashboardTemplate.description}</p>
            </div>
          </div>
          <Link href={dashboardTemplate.actionHref} className="rounded-xl bg-green-600 px-6 py-3 text-center text-sm font-bold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700">
            {dashboardTemplate.action}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dashboardTemplate.cards.map((card) => (
          <Link key={card.href + card.label} href={card.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <p className="text-base font-bold text-slate-950 dark:text-white">{card.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.description}</p>
          </Link>
        ))}
      </div>

      {showCommerceSummary ? (
        <div className="mt-6">
          <DashboardSummaryCards />
        </div>
      ) : null}
    </div>
  );
}

function getDashboardTemplate(profileType?: string, primaryActivity?: string | null): DashboardTemplate {
  const activity = (primaryActivity ?? "").toLowerCase();
  if (profileType === "pharmacy" || activity.includes("pharmacie")) {
    return { profile: "pharmacy", action: "POS Pharmacie", actionHref: "/dashboard/pos", description: "Espace pharmacie : vente medicaments, ordonnances, lots, expirations et stock faible.", cards: [
      { label: "POS Pharmacie", href: "/dashboard/pos", description: "Vendre rapidement un medicament ou un produit." },
      { label: "Medicaments", href: "/dashboard/products", description: "Gerer les produits et categories pharmacie." },
      { label: "Stock faible", href: "/dashboard/inventory", description: "Voir les produits sous le seuil minimum." },
      { label: "Ordonnances", href: "/dashboard/sales/quotes", description: "Preparer les ventes liees aux ordonnances." },
      { label: "Fournisseurs", href: "/dashboard/suppliers", description: "Suivre les fournisseurs pharmacie." },
      { label: "Rapports", href: "/dashboard/reports", description: "Consulter les ventes et alertes." }
    ] };
  }
  if (profileType === "clinic" || activity.includes("clinique")) {
    return { profile: "clinic", action: "Nouvelle consultation", actionHref: "/dashboard/sales/quotes", description: "Espace clinique : patients, rendez-vous, consultations, traitements, prescriptions et facturation.", cards: [
      { label: "Patients", href: "/dashboard/customers", description: "Gerer les fiches patients." },
      { label: "Rendez-vous", href: "/dashboard/sales/quotes", description: "Planifier les rendez-vous et visites." },
      { label: "Consultations", href: "/dashboard/sales", description: "Suivre les consultations en cours." },
      { label: "Traitements", href: "/dashboard/products", description: "Organiser les services et traitements." },
      { label: "Prescriptions", href: "/dashboard/sales/quotes", description: "Preparer les prescriptions." },
      { label: "Facturation", href: "/dashboard/sales/invoices", description: "Encaisser consultations et examens." }
    ] };
  }
  if (profileType === "hotel" || activity.includes("hotel")) {
    return { profile: "hotel", action: "Nouveau paiement", actionHref: "/dashboard/pos", description: "Espace hotel : chambres, reservations, check-in, check-out et paiements.", cards: [
      { label: "Chambres", href: "/dashboard/stores", description: "Preparer la gestion des chambres et locaux." },
      { label: "Reservations", href: "/dashboard/sales/quotes", description: "Creer et suivre les reservations." },
      { label: "Check-in", href: "/dashboard/sales", description: "Suivre les arrivees client." },
      { label: "Check-out", href: "/dashboard/sales/invoices", description: "Finaliser les sejours et factures." },
      { label: "Paiements", href: "/dashboard/payments", description: "Encaisser chambres et services." },
      { label: "Clients", href: "/dashboard/customers", description: "Gerer les clients de l'hotel." }
    ] };
  }
  if (profileType === "restaurant" || activity.includes("restaurant") || activity.includes("cafe") || activity.includes("bar")) {
    return { profile: "restaurant", action: "POS Restaurant", actionHref: "/dashboard/pos", description: "Espace restaurant : POS, commandes, tables, cuisine, menu, stock et ventes du jour.", cards: [
      { label: "POS Restaurant", href: "/dashboard/pos", description: "Prendre une commande simple au comptoir ou a table." },
      { label: "Commandes", href: "/dashboard/sales", description: "Voir les commandes ouvertes." },
      { label: "Tables", href: "/dashboard/pos", description: "Preparer la vente par table." },
      { label: "Cuisine", href: "/dashboard/pos/history", description: "Suivre les commandes en preparation." },
      { label: "Menu", href: "/dashboard/products", description: "Gerer les plats, boissons et extras." },
      { label: "Stock", href: "/dashboard/inventory", description: "Surveiller les ingredients et produits." }
    ] };
  }
  if (profileType === "school" || activity.includes("ecole")) {
    return { profile: "school", action: "Enregistrer paiement", actionHref: "/dashboard/pos", description: "Espace ecole : eleves, paiements, classes, frais scolaires et rapports.", cards: [
      { label: "Eleves", href: "/dashboard/customers", description: "Gerer les eleves comme clients scolaires." },
      { label: "Paiements", href: "/dashboard/payments", description: "Encaisser frais et services scolaires." },
      { label: "Classes", href: "/dashboard/stores", description: "Preparer l'organisation des classes." },
      { label: "Frais scolaires", href: "/dashboard/products", description: "Configurer les frais comme articles/services." },
      { label: "Rapports", href: "/dashboard/reports", description: "Suivre les encaissements et balances." }
    ] };
  }
  if (profileType === "manufacturing" || profileType === "windows-aluminium" || activity.includes("fabrication") || activity.includes("aluminium")) {
    return { profile: "production", action: "Nouveau devis", actionHref: "/dashboard/sales/quotes", description: "Espace fabrication : devis, projets, fabrication, installation, matieres premieres et produits finis.", cards: [
      { label: "Devis", href: "/dashboard/sales/quotes", description: "Creer un devis ou une commande client." },
      { label: "Projets", href: "/dashboard/sales", description: "Suivre les projets clients." },
      { label: "Fabrication", href: "/dashboard/sales/quotes", description: "Preparer le suivi de production." },
      { label: "Installation", href: "/dashboard/sales/invoices", description: "Suivre les livraisons et installations." },
      { label: "Matieres premieres", href: "/dashboard/inventory", description: "Suivre le stock utilise en production." },
      { label: "Produits finis", href: "/dashboard/products", description: "Gerer les produits prets a livrer." }
    ] };
  }
  if (profileType === "garage" || activity.includes("garage")) {
    return { profile: "garage", action: "Nouvelle réparation", actionHref: "/dashboard/sales/quotes", description: "Espace garage : vehicules, clients, reparations, rendez-vous, pieces et facturation.", cards: [
      { label: "Vehicules", href: "/dashboard/customers", description: "Associer les vehicules aux clients." },
      { label: "Clients", href: "/dashboard/customers", description: "Retrouver les clients rapidement." },
      { label: "Reparations", href: "/dashboard/sales/invoices", description: "Suivre les reparations et travaux." },
      { label: "Rendez-vous", href: "/dashboard/sales/quotes", description: "Planifier les passages atelier." },
      { label: "Pieces", href: "/dashboard/products", description: "Gerer les pieces et lubrifiants." },
      { label: "Facturation", href: "/dashboard/sales/invoices", description: "Facturer travaux et pieces." }
    ] };
  }
  return { profile: "commerce", action: "Nouvelle vente", actionHref: "/dashboard/pos", description: "Espace commerce : vente rapide, produits, stock faible, clients, ventes du jour et graphique 30 jours.", cards: [
    { label: "Nouvelle vente", href: "/dashboard/pos", description: "Encaisser une vente en quelques secondes." },
    { label: "Produits", href: "/dashboard/products", description: "Ajouter et suivre vos produits." },
    { label: "Stock faible", href: "/dashboard/inventory", description: "Verifier les articles a reapprovisionner." },
    { label: "Clients", href: "/dashboard/customers", description: "Retrouver vos clients rapidement." },
    { label: "Ventes du jour", href: "/dashboard/sales", description: "Voir les ventes et paiements du jour." },
    { label: "Graphique 30 jours", href: "/dashboard/reports", description: "Suivre l'evolution des ventes." }
  ] };
}

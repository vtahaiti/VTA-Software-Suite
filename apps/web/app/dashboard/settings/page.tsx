"use client";
import Link from "next/link";
import { useState } from "react";

const sections = [
  {
    title: "Profil entreprise",
    href: "/dashboard/settings/company",
    description: "Logo, coordonnées, activité et informations principales."
  },
  {
    title: "Activité et modules",
    href: "/dashboard/settings/business-modules",
    description: "Adapter les menus visibles au secteur de l'entreprise."
  },
  {
    title: "Impression",
    href: "/dashboard/settings/pos",
    description: "Paramètres caisse, ticket et impression."
  },
  {
    title: "Facturation",
    href: "/dashboard/settings/invoicing",
    description: "Numérotation, taxes et préférences de documents."
  },
  {
    title: "Abonnement",
    href: "/dashboard/settings/subscription",
    description: "Plan actif, limites et demandes de changement."
  },
  {
    title: "Emails",
    href: "/dashboard/settings/emails",
    description: "Expéditeur et modèles de messages."
  },
  {
    title: "Rôles",
    href: "/dashboard/settings/roles",
    description: "Rôles internes et permissions associées."
  }
];

// Vue technique (liste brute des cles de permission par role) : utile pour un support avance, pas pour
// une gestion quotidienne. Retiree de la grille principale et repliee par defaut plutot que supprimee,
// pour ne pas la mettre devant un client qui gere juste son entreprise au quotidien.
const advancedSections = [
  {
    title: "Permissions",
    href: "/dashboard/settings/permissions",
    description: "Vue avancée des droits disponibles."
  }
];

export default function SettingsPage() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Paramètres</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Paramètres de l&apos;entreprise</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Choisissez la section à configurer. Cette page regroupe les réglages existants sans modifier vos données.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{section.title}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
          </Link>
        ))}
      </section>

      <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="text-sm font-semibold text-slate-500 hover:text-brand-600">
        {showAdvanced ? "Masquer les options avancées" : "Options avancées"}
      </button>
      {showAdvanced ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {advancedSections.map((section) => (
            <Link key={section.href} href={section.href} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-950">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{section.title}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}

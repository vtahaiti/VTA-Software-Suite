"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { getCompanyBranding, type CompanyBranding } from "@/lib/company-branding";

const STOCK_ZONES = [
  { key: "fridge", label: "Frigo / Congélateur" },
  { key: "bar", label: "Bar / Boissons" },
  { key: "kitchen", label: "Cuisine / Ingrédients" },
  { key: "depot", label: "Dépôt" },
  { key: "supplies", label: "Fournitures" }
];

export function RestaurantDashboard() {
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [openOrdersCount, setOpenOrdersCount] = useState<number | null>(null);
  const currentUser = getCurrentUser();
  const companyName = branding?.companyName ?? currentUser?.tenant ?? "Mon entreprise";

  useEffect(() => {
    const token = getAccessToken();
    if (token) void getCompanyBranding(token).then(setBranding).catch(() => undefined);
    void fetchWithAuth(`${apiUrl}/pos/held-sales`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setOpenOrdersCount(Array.isArray(data?.items) ? data.items.length : null))
      .catch(() => setOpenOrdersCount(null));
  }, []);

  return (
    <div className="space-y-4 pb-6 lg:space-y-6 lg:pb-8">
      {/* Section 1 : Action principale */}
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 via-green-600 to-slate-950 p-4 text-white shadow-xl shadow-emerald-900/20 dark:border-emerald-900 sm:p-5 lg:rounded-[28px] lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 sm:text-xs">Action principale</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">Nouvelle commande</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-emerald-50 sm:text-sm">Table, comptoir ou emporter. Bonjour {currentUser?.name?.split(" ")[0] ?? "à vous"}, {companyName} est prêt.</p>
          </div>
          <Link href="/dashboard/pos" className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-700 shadow-xl transition hover:-translate-y-0.5 hover:bg-emerald-50 sm:w-auto lg:px-7 lg:py-4 lg:text-base">
            Nouvelle commande
          </Link>
        </div>
      </section>

      {/* Section 2 : Commandes en cours */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-brand-600">Commandes en cours</p>
            <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{openOrdersCount === null ? "—" : openOrdersCount} commande{openOrdersCount === 1 ? "" : "s"} ouverte{openOrdersCount === 1 ? "" : "s"}</h2>
          </div>
          <Link href="/dashboard/sales/in-progress" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">Voir commandes ouvertes</Link>
        </div>
      </section>

      {/* Section 3 : Encaissement */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/sales/completed" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-bold text-brand-600">Encaissement</p>
          <h2 className="mt-2 text-lg font-black text-slate-950 dark:text-white">Historique des ventes</h2>
        </Link>
        <Link href="/dashboard/cash-registers/sessions" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-bold text-brand-600">Encaissement</p>
          <h2 className="mt-2 text-lg font-black text-slate-950 dark:text-white">Sessions de caisse</h2>
        </Link>
      </section>

      {/* Section 4 : Menu */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/products" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-bold text-brand-600">Menu</p>
          <h2 className="mt-2 text-lg font-black text-slate-950 dark:text-white">Produits / menu</h2>
        </Link>
        <Link href="/dashboard/products/categories" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-bold text-brand-600">Menu</p>
          <h2 className="mt-2 text-lg font-black text-slate-950 dark:text-white">Catégories</h2>
        </Link>
      </section>

      {/* Section 5 : Stock Restaurant */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-bold text-brand-600">Stock Restaurant</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {STOCK_ZONES.map((zone) => (
            <Link key={zone.key} href={`/dashboard/restaurant/stock?zone=${zone.key}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {zone.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

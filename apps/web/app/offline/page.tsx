"use client";

import { useEffect, useState } from "react";
import { getOfflineSummary } from "@/lib/offline-db";
import { useNetworkStatus } from "@/lib/network-status";

type Summary = Awaited<ReturnType<typeof getOfflineSummary>>;

export default function OfflinePage() {
  const { isOnline, lastCheckedAt } = useNetworkStatus();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    void getOfflineSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-600">Mode hors ligne</p>
        <h1 className="mt-3 text-2xl font-bold">Le POS reste disponible</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Les produits deja charges restent disponibles sur ce telephone ou cet ordinateur. Les ventes hors ligne sont gardees localement, puis synchronisees quand l API revient.
        </p>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <StatusCard label="Connexion" value={isOnline ? "En ligne" : "Hors ligne"} tone={isOnline ? "green" : "amber"} />
          <StatusCard label="Produits caches" value={String(summary?.products ?? 0)} />
          <StatusCard label="Clients caches" value={String(summary?.customers ?? 0)} />
          <StatusCard label="Ventes en attente" value={String(summary?.pendingSales ?? 0)} tone={(summary?.pendingSales ?? 0) > 0 ? "amber" : "green"} />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Derniere verification : {lastCheckedAt ? lastCheckedAt.toLocaleString("fr-HT") : "en cours"}.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <a href="/dashboard/pos" className="inline-flex justify-center rounded-md bg-green-600 px-4 py-3 text-sm font-bold text-white">Retour au POS</a>
          <a href="/dashboard" className="inline-flex justify-center rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold dark:border-slate-700">Tableau de bord</a>
        </div>
      </section>
    </main>
  );
}

function StatusCard({ label, value, tone = "slate" }: { label: string; value: string; tone?: "green" | "amber" | "slate" }) {
  const toneClass = tone === "green" ? "text-green-700 dark:text-green-300" : tone === "amber" ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

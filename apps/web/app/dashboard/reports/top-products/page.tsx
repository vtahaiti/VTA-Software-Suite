"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { businessDateKey } from "@/lib/business-timezone";
import { formatMoney, pluralize } from "@/lib/format";

type ProductRow = { name: string; sku: string | null; quantitySold: number; revenue: number; salesCount: number };
type Period = "today" | "week" | "month" | "custom";

export default function TopProductsReportPage() {
  const today = useMemo(() => businessDateKey(new Date()), []);
  const weekStart = useMemo(() => {
    const date = new Date();
    const day = date.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - diffToMonday);
    return businessDateKey(date);
  }, []);
  const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today]);

  const [period, setPeriod] = useState<Period>("month");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period === "today") { setDateFrom(today); setDateTo(today); }
    if (period === "week") { setDateFrom(weekStart); setDateTo(today); }
    if (period === "month") { setDateFrom(monthStart); setDateTo(today); }
  }, [period, today, weekStart, monthStart]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const response = await fetch(`${apiUrl}/reports/top-products?${params}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      if (!response.ok) throw new Error("Impossible de charger le classement des produits.");
      const data = await response.json();
      setItems(data.items ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de charger le classement des produits.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600">Rapports</p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Produits les plus vendus</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Classement par quantité vendue sur la période.</p>
        </div>
        <Link href="/dashboard/reports" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Retour aux rapports</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <button onClick={() => setPeriod("today")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${period === "today" ? "bg-brand-600 text-white" : "dark:border-slate-700"}`}>Aujourd&apos;hui</button>
        <button onClick={() => setPeriod("week")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${period === "week" ? "bg-brand-600 text-white" : "dark:border-slate-700"}`}>Cette semaine</button>
        <button onClick={() => setPeriod("month")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${period === "month" ? "bg-brand-600 text-white" : "dark:border-slate-700"}`}>Ce mois</button>
        <button onClick={() => setPeriod("custom")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${period === "custom" ? "bg-brand-600 text-white" : "dark:border-slate-700"}`}>Personnalisé</button>
        {period === "custom" ? (
          <>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </>
        ) : <span className="text-sm text-slate-500">{dateFrom} → {dateTo}</span>}
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
      {isLoading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement...</div> : null}

      {!isLoading ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr><th className="p-3 font-semibold">#</th><th className="p-3 font-semibold">Produit</th><th className="p-3 font-semibold">SKU</th><th className="p-3 font-semibold">Quantité vendue</th><th className="p-3 font-semibold">Chiffre d&apos;affaires</th><th className="p-3 font-semibold">Ventes</th></tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${item.sku ?? item.name}-${index}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3 text-slate-500">{index + 1}</td>
                      <td className="p-3 font-semibold text-slate-950 dark:text-white">{item.name}</td>
                      <td className="p-3 font-mono text-xs text-slate-500">{item.sku ?? "--"}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{item.quantitySold}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{formatMoney(item.revenue)}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{pluralize(item.salesCount, "vente")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Aucune vente pour cette période.</div>}
        </section>
      ) : null}
    </div>
  );
}

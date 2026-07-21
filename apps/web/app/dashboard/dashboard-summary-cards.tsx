"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "../../lib/auth";
import { businessDateKey, formatBusinessDate } from "@/lib/business-timezone";

type SalesPoint = { date: string; total: number; count: number };
type DashboardSummary = {
  databaseAvailable: boolean;
  salesToday: number;
  products: number;
  invoices: number;
  lowStock: number;
  salesLast30Days: SalesPoint[];
};


const emptySummary: DashboardSummary = {
  databaseAvailable: true,
  salesToday: 0,
  products: 0,
  invoices: 0,
  lowStock: 0,
  salesLast30Days: buildEmptyTrend()
};

export function DashboardSummaryCards() {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      setError("Session introuvable. Veuillez vous reconnecter.");
      setIsLoading(false);
      return;
    }

    fetch(`${apiUrl}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include"
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossible de charger les donnees du tableau de bord.");
        return response.json() as Promise<DashboardSummary>;
      })
      .then((data) => {
        setSummary({ ...emptySummary, ...data, salesLast30Days: data.salesLast30Days?.length ? data.salesLast30Days : buildEmptyTrend() });
        setError(null);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setIsLoading(false));
  }, []);

  const cards = useMemo(
    () => [
      { title: "Ventes du jour", value: summary.salesToday.toString(), detail: "Ventes validees aujourd'hui" },
      { title: "Stock faible", value: summary.lowStock.toString(), detail: "Produits sous le seuil minimum" },
      { title: "Factures", value: summary.invoices.toString(), detail: "Documents non annules" },
      { title: "Produits", value: summary.products.toString(), detail: "Produits actifs" }
    ],
    [summary]
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {!summary.databaseAvailable && !error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          PostgreSQL est indisponible. Le tableau affiche des valeurs a zero jusqu au demarrage de la base de donnees.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
            <p className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">{isLoading ? "..." : card.value}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{card.detail}</p>
          </article>
        ))}
      </section>

      <SalesTrendChart data={summary.salesLast30Days} isLoading={isLoading} />
    </div>
  );
}

function SalesTrendChart({ data, isLoading }: { data: SalesPoint[]; isLoading: boolean }) {
  const width = 720;
  const height = 220;
  const padding = 24;
  const values = data.length ? data : buildEmptyTrend();
  const max = Math.max(...values.map((item) => item.total), 0);
  const points = values.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
    const ratio = max > 0 ? item.total / max : 0;
    const y = height - padding - ratio * (height - padding * 2);
    return { x, y, ...item };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const total = values.reduce((sum, item) => sum + item.total, 0);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ventes des 30 derniers jours</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Evolution des ventes</h2>
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total : {isLoading ? "..." : formatCurrency(total)}</p>
      </div>
      <div className="mt-5 overflow-hidden rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Graphique des ventes des 30 derniers jours" className="h-64 w-full">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
          <polyline points={area} fill="#dbeafe" opacity="0.8" />
          <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="3.5" fill="#2563eb" />)}
        </svg>
      </div>
      <div className="mt-3 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{formatShortDate(values[0]?.date)}</span>
        <span>{max > 0 ? "Les hausses et baisses suivent les ventes reelles." : "Aucune vente sur la periode."}</span>
        <span>{formatShortDate(values[values.length - 1]?.date)}</span>
      </div>
    </article>
  );
}

function buildEmptyTrend() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: SalesPoint[] = [];
  for (let index = 29; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    result.push({ date: businessDateKey(date), total: 0, count: 0 });
  }
  return result;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(value);
}

function formatShortDate(value?: string) {
  if (!value) return "";
  return formatBusinessDate(`${value}T12:00:00`);
}

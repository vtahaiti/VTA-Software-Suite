"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clearSession, getAccessToken, getCurrentUser, refreshSession } from "@/lib/auth";
import { CompanyBranding, getCompanyBranding } from "@/lib/company-branding";
import { businessDateKey, formatBusinessDateTime } from "@/lib/business-timezone";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

type Kpis = {
  revenueToday: number;
  revenueMonth: number;
  profitMonth: number | null;
  profitReliable?: boolean;
  costIncompleteMessage?: string | null;
  salesToday: number;
  salesTotal: number;
  customersTotal: number;
  productsTotal: number;
  outOfStock: number;
  lowStock: number;
  invoicesPaid: number;
  invoicesUnpaid: number;
  pendingOrders: number;
};
type Performance = {
  stockValue: number;
  knownStockValue?: number;
  salePotentialValue?: number;
  potentialKnownMargin?: number;
  stockValuePartial?: boolean;
  missingCostProducts?: number;
  businessValue: number;
  estimatedProfit: number | null;
  profitReliable?: boolean;
  missingCostSaleLines?: number;
  revenueWithoutCost?: number;
  costCoverageRate?: number;
  averageMargin: number | null;
  averageOrderValue: number;
  averageDailySales: number;
  monthlyGrowth: number | null;
  monthlyGrowthLabel?: string;
  annualGrowth: number | null;
  annualGrowthLabel?: string;
};
type TrendPoint = { date: string; sales: number; revenue: number; profit: number | null; customers: number; revenueWithoutCost?: number; missingCostLines?: number };
type LabelValue = { label?: string; date?: string; value: number | null; reliable?: boolean; revenueWithoutCost?: number };
type TopProduct = { product: string; sku: string; quantity: number; revenue: number; profit: number | null; revenueWithoutCost?: number; missingCostLines?: number };
type DashboardSummary = {
  databaseAvailable: boolean;
  generatedAt: string;
  kpis: Kpis;
  performance: Performance;
  charts: {
    trend30Days: TrendPoint[];
    profitEvolution: LabelValue[];
    revenueEvolution: LabelValue[];
    weeklySales: Array<{ label: string; sales: number; revenue: number }>;
    topProducts: TopProduct[];
    salesByCategory: LabelValue[];
    paymentMethods: LabelValue[];
    customerEvolution: LabelValue[];
    stockValueByCategory: LabelValue[];
  };
  recentActivity: Array<{ type: string; label: string; amount: number; createdAt: string }>;
  alerts: Array<{ type: string; message: string; severity: "critical" | "warning" | "info" | string }>;
  topSalesTable: TopProduct[];
};

const emptyDashboard: DashboardSummary = {
  databaseAvailable: true,
  generatedAt: new Date().toISOString(),
  kpis: {
    revenueToday: 0,
    revenueMonth: 0,
    profitMonth: null,
    profitReliable: false,
    costIncompleteMessage: "Données de coût incomplètes",
    salesToday: 0,
    salesTotal: 0,
    customersTotal: 0,
    productsTotal: 0,
    outOfStock: 0,
    lowStock: 0,
    invoicesPaid: 0,
    invoicesUnpaid: 0,
    pendingOrders: 0
  },
  performance: {
    stockValue: 0,
    knownStockValue: 0,
    salePotentialValue: 0,
    potentialKnownMargin: 0,
    stockValuePartial: false,
    missingCostProducts: 0,
    businessValue: 0,
    estimatedProfit: null,
    profitReliable: false,
    missingCostSaleLines: 0,
    revenueWithoutCost: 0,
    costCoverageRate: 0,
    averageMargin: null,
    averageOrderValue: 0,
    averageDailySales: 0,
    monthlyGrowth: 0,
    monthlyGrowthLabel: "0 %",
    annualGrowth: 0,
    annualGrowthLabel: "0 %"
  },
  charts: {
    trend30Days: buildEmptyTrend(),
    profitEvolution: [],
    revenueEvolution: [],
    weeklySales: [],
    topProducts: [],
    salesByCategory: [],
    paymentMethods: [],
    customerEvolution: [],
    stockValueByCategory: []
  },
  recentActivity: [],
  alerts: [],
  topSalesTable: []
};

function isCashierDashboardUser(user: ReturnType<typeof getCurrentUser>) {
  const roles = [user?.role, ...(user?.roles ?? [])].filter(Boolean).map((role) => String(role).toUpperCase());
  const roleText = roles.join(" ");
  if (roleText.includes("CASHIER") || roleText.includes("CAISSIER")) return true;
  const permissions = new Set(user?.permissions ?? []);
  return permissions.has("pos.sell") && !permissions.has("products.view") && !permissions.has("inventory.view");
}

export default function DashboardPage() {
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (isCashierDashboardUser(currentUser)) {
      window.location.replace("/dashboard/pos");
      return;
    }

    async function loadDashboardSummary() {
      let token = getAccessToken();
      if (!token) {
        window.location.href = "/login";
        return null;
      }

      void getCompanyBranding(token).then(setBranding).catch(() => undefined);

      let response = await fetch(`${apiUrl}/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include"
      });

      if (response.status === 401 || response.status === 403) {
        const refreshedUser = await refreshSession();
        token = refreshedUser ? getAccessToken() : null;

        if (!token) {
          clearSession();
          window.location.href = "/login";
          return null;
        }

        void getCompanyBranding(token).then(setBranding).catch(() => undefined);
        response = await fetch(`${apiUrl}/dashboard/summary`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include"
        });
      }

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      return response.json() as Promise<DashboardSummary>;
    }

    loadDashboardSummary()
      .then((data) => {
        if (!data) return;
        setSummary({ ...emptyDashboard, ...data, charts: { ...emptyDashboard.charts, ...data.charts } });
        setError("");
      })
      .catch((requestError: Error) => setError(requestError.message || "Impossible de charger les données du tableau de bord."))
      .finally(() => setIsLoading(false));
  }, []);

  const currentUser = getCurrentUser();
  const companyName = branding?.companyName ?? currentUser?.tenant ?? "Mon entreprise";
  const primaryColor = branding?.primaryColor ?? "#2563eb";
  const kpiCards = useMemo(() => [
    { label: "Chiffre d'affaires du jour", value: formatMoney(summary.kpis.revenueToday), tone: "green" },
    { label: "Chiffre d'affaires du mois", value: formatMoney(summary.kpis.revenueMonth), tone: "blue" },
    { label: "Bénéfice du mois", value: summary.kpis.profitReliable === false ? "Données de coût incomplètes" : formatNullableMoney(summary.kpis.profitMonth), tone: "violet" },
    { label: "Ventes aujourd'hui", value: formatNumber(summary.kpis.salesToday), tone: "slate" },
    { label: "Total ventes", value: formatNumber(summary.kpis.salesTotal), tone: "slate" },
    { label: "Clients", value: formatNumber(summary.kpis.customersTotal), tone: "blue" },
    { label: "Produits", value: formatNumber(summary.kpis.productsTotal), tone: "blue" },
    { label: "Ruptures", value: formatNumber(summary.kpis.outOfStock), tone: "red" },
    { label: "Stock faible", value: formatNumber(summary.kpis.lowStock), tone: "amber" },
    { label: "Factures payées", value: formatNumber(summary.kpis.invoicesPaid), tone: "green" },
    { label: "Factures impayées", value: formatNumber(summary.kpis.invoicesUnpaid), tone: "amber" },
    { label: "Commandes en attente", value: formatNumber(summary.kpis.pendingOrders), tone: "slate" }
  ], [summary]);

  return (
    <div className="space-y-4 pb-6 lg:space-y-8 lg:pb-8">
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 via-green-600 to-slate-950 p-4 text-white shadow-xl shadow-emerald-900/20 dark:border-emerald-900 sm:p-5 lg:rounded-[28px] lg:p-6 lg:shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex items-start gap-3 lg:gap-4">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Logo URL comes from tenant settings and may be external.
              <img src={branding.logoUrl} alt={`Logo ${companyName}`} className="h-12 w-12 rounded-2xl bg-white object-cover p-1 shadow-lg sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-base font-black shadow-lg ring-1 ring-white/30 sm:h-14 sm:w-14 sm:text-lg lg:h-16 lg:w-16 lg:text-xl">
                {branding?.companyInitials ?? "ME"}
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 sm:text-xs lg:text-sm">Action principale</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl lg:mt-2 lg:text-4xl">Nouvelle vente</h1>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-emerald-50 sm:text-sm lg:mt-3 lg:leading-6">
                Bonjour {currentUser?.name?.split(" ")[0] ?? "à vous"}. Encaissez rapidement une vente pour {companyName}.
              </p>
            </div>
          </div>
          <Link href="/dashboard/pos" className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-700 shadow-xl transition hover:-translate-y-0.5 hover:bg-emerald-50 sm:w-auto lg:px-7 lg:py-4 lg:text-base">
            Ouvrir la caisse
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white">Réessayer</button>
        </div>
      ) : null}

      {isLoading ? <DashboardSkeleton /> : (
        <>
      <section className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
        {kpiCards.map((card) => <KpiCard key={card.label} {...card} isLoading={isLoading} />)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <MainTrendChart data={summary.charts.trend30Days.length ? summary.charts.trend30Days : buildEmptyTrend()} isLoading={isLoading} />
        <AlertsPanel alerts={summary.alerts} />
      </section>

      <section className="grid gap-6 xl:grid-cols-4">
        <MiniChart title="Évolution bénéfices" data={summary.charts.trend30Days.map((point) => ({ label: point.date, value: point.profit }))} color="#7c3aed" />
        <MiniChart title="Évolution chiffre d'affaires" data={summary.charts.trend30Days.map((point) => ({ label: point.date, value: point.revenue }))} color="#2563eb" />
        <BarChart title="Ventes hebdomadaires" data={summary.charts.weeklySales.map((week) => ({ label: week.label, value: week.sales }))} color="#16a34a" />
        <BarChart title="Valeur du stock" data={summary.charts.stockValueByCategory} color={primaryColor} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <DonutList title="Top 10 produits vendus" items={summary.charts.topProducts.map((item) => ({ label: item.product, value: item.revenue }))} />
        <DonutList title="Ventes par catégorie" items={summary.charts.salesByCategory} />
        <DonutList title="Modes de paiement" items={summary.charts.paymentMethods} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <PerformancePanel performance={summary.performance} />
        <RecentActivity items={summary.recentActivity} />
      </section>

      <TopSalesTable items={summary.topSalesTable} />
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, tone, isLoading }: { label: string; value: string; tone: string; isLoading: boolean }) {
  const palette: Record<string, string> = {
    green: "from-emerald-50 to-white text-emerald-700 dark:from-emerald-950/50 dark:to-slate-900",
    blue: "from-blue-50 to-white text-blue-700 dark:from-blue-950/50 dark:to-slate-900",
    violet: "from-violet-50 to-white text-violet-700 dark:from-violet-950/50 dark:to-slate-900",
    amber: "from-amber-50 to-white text-amber-700 dark:from-amber-950/50 dark:to-slate-900",
    red: "from-red-50 to-white text-red-700 dark:from-red-950/50 dark:to-slate-900",
    slate: "from-slate-50 to-white text-slate-800 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100"
  };
  return (
    <article className={`rounded-2xl border border-slate-200 bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 ${palette[tone] ?? palette.slate}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-4 text-2xl font-black tracking-tight">{isLoading ? <span className="block h-8 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /> : value}</p>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />)}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="h-96 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
        <div className="h-96 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
      </section>
    </div>
  );
}

function MainTrendChart({ data, isLoading }: { data: TrendPoint[]; isLoading: boolean }) {
  const revenue = data.map((point) => point.revenue);
  const profit = data.map((point) => point.profit);
  const sales = data.map((point) => point.sales);
  const max = Math.max(...revenue, ...profit.map((value) => value ?? 0), ...sales, 1);
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Graphique principal</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Ventes, chiffre d&apos;affaires et bénéfices</h2>
        </div>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-300">30 derniers jours · {isLoading ? "chargement" : "données réelles"}</p>
      </div>
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
        <svg viewBox="0 0 900 320" className="h-80 w-full" role="img" aria-label="Tendance business des 30 derniers jours">
          {[0, 1, 2, 3].map((line) => <line key={line} x1="40" x2="870" y1={40 + line * 70} y2={40 + line * 70} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />)}
          <ChartPath data={revenue} max={max} color="#2563eb" />
          <ChartPath data={profit.map((value) => value ?? 0)} max={max} color="#7c3aed" />
          <ChartPath data={sales} max={max} color="#16a34a" />
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold">
        <Legend color="#2563eb" label="Chiffre d&apos;affaires" />
        <Legend color="#7c3aed" label="Bénéfices" />
        <Legend color="#16a34a" label="Ventes" />
      </div>
    </article>
  );
}

function ChartPath({ data, max, color }: { data: number[]; max: number; color: string }) {
  const points = (data.length ? data : Array(30).fill(0)).map((value, index, values) => {
    const x = 40 + (index * 830) / Math.max(values.length - 1, 1);
    const y = 280 - (Math.max(value, 0) / max) * 230;
    return `${x},${y}`;
  });
  return <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="animate-[dash_1.2s_ease-out]" />;
}

function MiniChart({ title, data, color }: { title: string; data: LabelValue[]; color: string }) {
  const values = data.map((item) => item.value ?? 0);
  const hasMissingCost = data.some((item) => item.value === null);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-black text-slate-950 dark:text-white">{title}</h3>
      {hasMissingCost ? <p className="mt-2 text-xs font-semibold text-amber-600">Non calculable sur certaines périodes : coût non renseigné.</p> : null}
      <svg viewBox="0 0 900 320" className="mt-4 h-32 w-full">
        <ChartPath data={values} max={Math.max(...values, 1)} color={color} />
      </svg>
    </article>
  );
}

function BarChart({ title, data, color }: { title: string; data: LabelValue[]; color: string }) {
  const max = Math.max(...data.map((item) => item.value ?? 0), 1);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-black text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {(data.length ? data : [{ label: "Aucune donnée", value: 0 }]).slice(0, 6).map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>{item.label}</span><span>{formatCompact(item.value ?? 0)}</span></div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full" style={{ width: `${Math.max(4, ((item.value ?? 0) / max) * 100)}%`, backgroundColor: color }} /></div>
          </div>
        ))}
      </div>
    </article>
  );
}

function DonutList({ title, items }: { title: string; items: LabelValue[] }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-base font-black text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {(items.length ? items : [{ label: "Aucune donnée", value: 0 }]).slice(0, 10).map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
            <span className="font-black text-slate-950 dark:text-white">{formatCompact(item.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function AlertsPanel({ alerts }: { alerts: DashboardSummary["alerts"] }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-black text-slate-950 dark:text-white">Alertes</h2>
      <div className="mt-5 space-y-3">
        {(alerts.length ? alerts : [{ type: "Tout va bien", message: "Aucune alerte importante pour le moment.", severity: "info" }]).map((alert, index) => (
          <div key={`${alert.type}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-black text-slate-950 dark:text-white">{alert.type}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function PerformancePanel({ performance }: { performance: Performance }) {
  const rows = [
    ["Valeur connue du stock", formatMoney(performance.stockValue)],
    ["Produits sans coût", String(performance.missingCostProducts ?? 0)],
    ["Valeur estimée du business", formatMoney(performance.businessValue)],
    ["Bénéfices estimés", performance.profitReliable === false ? "Données de coût incomplètes" : formatNullableMoney(performance.estimatedProfit)],
    ["Revenu sans coût", formatMoney(performance.revenueWithoutCost ?? 0)],
    ["Couverture des coûts", `${performance.costCoverageRate ?? 0}%`],
    ["Marge moyenne", performance.averageMargin === null ? "Non calculable" : `${performance.averageMargin}%`],
    ["Panier moyen", formatMoney(performance.averageOrderValue)],
    ["Ventes moyennes / jour", formatNumber(performance.averageDailySales)],
    ["Croissance mensuelle", performance.monthlyGrowthLabel ?? formatGrowth(performance.monthlyGrowth)],
    ["Croissance annuelle", performance.annualGrowthLabel ?? formatGrowth(performance.annualGrowth)]
  ];
  const businessRows = [
    ["Valeur stock connue", formatMoney(performance.knownStockValue ?? performance.stockValue)],
    ["Valeur de vente potentielle", formatMoney(performance.salePotentialValue ?? performance.businessValue)],
    ["Marge potentielle connue", formatMoney(performance.potentialKnownMargin ?? 0)],
    ["Produits sans coût d'achat", String(performance.missingCostProducts ?? 0)],
    ["Bénéfices du mois", performance.profitReliable === false ? "Données de coût incomplètes" : formatNullableMoney(performance.estimatedProfit)],
    ["Revenu sans coût", formatMoney(performance.revenueWithoutCost ?? 0)],
    ["Couverture des coûts", `${performance.costCoverageRate ?? 0}%`],
    ["Marge moyenne", performance.averageMargin === null ? "Non calculable" : `${performance.averageMargin}%`],
    ["Panier moyen", formatMoney(performance.averageOrderValue)],
    ["Ventes moyennes / jour", formatNumber(performance.averageDailySales)],
    ["Croissance mensuelle", performance.monthlyGrowthLabel ?? formatGrowth(performance.monthlyGrowth)],
    ["Croissance annuelle", performance.annualGrowthLabel ?? formatGrowth(performance.annualGrowth)]
  ];
  const rowsForDisplay = businessRows.slice(0, rows.length);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-black text-slate-950 dark:text-white">Performance du business</h2>
      {(performance.missingCostProducts ?? 0) > 0 ? (
        <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
          {performance.missingCostProducts} produit(s) sans coût d&apos;achat - valeur stock incomplète.
        </p>
      ) : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {rowsForDisplay.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{value}</p></div>)}
      </div>
    </article>
  );
}

function RecentActivity({ items }: { items: DashboardSummary["recentActivity"] }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-black text-slate-950 dark:text-white">Activité récente</h2>
      <div className="mt-5 space-y-3">
        {(items.length ? items : [{ type: "Aucune activité", label: "Les prochaines actions apparaîtront ici.", amount: 0, createdAt: new Date().toISOString() }]).map((item, index) => (
          <div key={`${item.type}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
            <div><p className="font-black text-slate-950 dark:text-white">{item.type}</p><p className="text-sm text-slate-500">{item.label}</p></div>
            <div className="text-right"><p className="font-black">{item.amount ? formatMoney(item.amount) : ""}</p><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></div>
          </div>
        ))}
      </div>
    </article>
  );
}

function TopSalesTable({ items }: { items: TopProduct[] }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="text-xl font-black text-slate-950 dark:text-white">Tableau des meilleures ventes</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950">
            <tr><th className="p-4">Top produits</th><th className="p-4">Quantité vendue</th><th className="p-4">Chiffre d&apos;affaires</th><th className="p-4">Profit généré</th></tr>
          </thead>
          <tbody>
            {(items.length ? items : [{ product: "Aucune vente", sku: "-", quantity: 0, revenue: 0, profit: 0 }]).map((item) => (
              <tr key={`${item.sku}-${item.product}`} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-4 font-bold text-slate-950 dark:text-white">{item.product}<p className="text-xs font-medium text-slate-500">{item.sku}</p></td>
                <td className="p-4">{formatNumber(item.quantity)}</td>
                <td className="p-4">{formatMoney(item.revenue)}</td>
                <td className="p-4 font-bold text-emerald-600">{item.profit === null ? "Non calculable" : formatMoney(item.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>;
}

function buildEmptyTrend(): TrendPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    return { date: businessDateKey(date), sales: 0, revenue: 0, profit: null, customers: 0, revenueWithoutCost: 0, missingCostLines: 0 };
  });
}

async function readApiError(response: Response) {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Impossible de charger les données du tableau de bord.";
  } catch {
    return "Impossible de charger les données du tableau de bord.";
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("fr-HT", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function formatDate(value: string) {
  return formatBusinessDateTime(value);
}

function formatGrowth(value: number | null | undefined) {
  if (value === null || value === undefined) return "Non calculable";
  return `${value} %`;
}

function formatNullableMoney(value: number | null | undefined) {
  return value === null || value === undefined ? "Non calculable" : formatMoney(value);
}



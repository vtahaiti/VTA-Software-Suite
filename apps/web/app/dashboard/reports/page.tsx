"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Primitive = string | number | boolean | null | undefined;
type ReportRow = Record<string, Primitive>;
type ReportSummary = Record<string, Primitive | Array<Record<string, Primitive>>>;
type ReportSection = {
  summary: ReportSummary;
  items?: ReportRow[];
  recentMovements?: ReportRow[];
  meta?: { total: number; page: number; limit: number; pages: number };
};
type ReportsDashboard = {
  sales: ReportSection;
  products: ReportSection;
  inventory: ReportSection;
  customers: ReportSection;
  purchases: ReportSection;
  profit: ReportSection;
};
type Column = { key: string; label: string; format?: "money" | "date" | "status" | "boolean" };

type SectionConfig = {
  key: keyof ReportsDashboard;
  title: string;
  description: string;
  columns: Column[];
  emptyText: string;
};

const sections: SectionConfig[] = [
  {
    key: "sales",
    title: "Rapport des ventes",
    description: "Suivi des ventes, taxes, remises et paiements.",
    emptyText: "Aucune vente pour cette période.",
    columns: [
      { key: "customer", label: "Client" },
      { key: "status", label: "Statut", format: "status" },
      { key: "items", label: "Articles" },
      { key: "total", label: "Total", format: "money" },
      { key: "createdAt", label: "Date", format: "date" }
    ]
  },
  {
    key: "products",
    title: "Rapport produits",
    description: "Catalogue, prix, stock et activité produits.",
    emptyText: "Aucun produit trouvé.",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Produit" },
      { key: "category", label: "Catégorie" },
      { key: "brand", label: "Marque" },
      { key: "stock", label: "Stock" },
      { key: "salePrice", label: "Prix", format: "money" },
      { key: "isActive", label: "Actif", format: "boolean" }
    ]
  },
  {
    key: "inventory",
    title: "Rapport inventaire",
    description: "Quantités, réservations, dépôts et alertes de stock.",
    emptyText: "Aucune ligne de stock disponible.",
    columns: [
      { key: "product", label: "Produit" },
      { key: "warehouse", label: "Dépôt" },
      { key: "quantity", label: "Quantité" },
      { key: "reserved", label: "Réservé" },
      { key: "available", label: "Disponible" },
      { key: "minimumStock", label: "Stock min." },
      { key: "isLowStock", label: "Alerte", format: "boolean" }
    ]
  },
  {
    key: "customers",
    title: "Rapport clients",
    description: "Clients, soldes, limites de crédit et statuts.",
    emptyText: "Aucun client pour cette période.",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Client" },
      { key: "company", label: "Entreprise" },
      { key: "phone", label: "Téléphone" },
      { key: "city", label: "Ville" },
      { key: "currentBalance", label: "Solde", format: "money" },
      { key: "status", label: "Statut", format: "status" }
    ]
  },
  {
    key: "purchases",
    title: "Rapport achats",
    description: "Bons de commande, réceptions et volumes fournisseurs.",
    emptyText: "Aucun achat pour cette période.",
    columns: [
      { key: "number", label: "Numéro" },
      { key: "supplier", label: "Fournisseur" },
      { key: "status", label: "Statut", format: "status" },
      { key: "items", label: "Articles" },
      { key: "receipts", label: "Réceptions" },
      { key: "total", label: "Total", format: "money" },
      { key: "createdAt", label: "Date", format: "date" }
    ]
  },
  {
    key: "profit",
    title: "Rapport profits",
    description: "Marge brute, coûts, retours et performance commerciale.",
    emptyText: "Aucune ligne de profit disponible.",
    columns: [
      { key: "product", label: "Produit" },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Quantité" },
      { key: "revenue", label: "Revenu", format: "money" },
      { key: "cost", label: "Coût", format: "money" },
      { key: "profit", label: "Profit", format: "money" },
      { key: "createdAt", label: "Date", format: "date" }
    ]
  }
];

export default function ReportsPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(today);
  const [reports, setReports] = useState<ReportsDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "10" });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const response = await fetch(`${apiUrl}/reports/dashboard?${params}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` }
      });
      if (!response.ok) throw new Error("Impossible de charger les rapports.");
      setReports((await response.json()) as ReportsDashboard);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erreur de chargement des rapports.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  function prepareExport(format: "CSV" | "Excel") {
    window.alert(`Export ${format} prepare pour les rapports.`);
  }

  const cards = reports
    ? [
        { label: "Ventes", value: formatMoney(numberValue(reports.sales.summary.total)), detail: `${numberValue(reports.sales.summary.count)} ventes` },
        { label: "Produits", value: numberValue(reports.products.summary.count).toString(), detail: `${numberValue(reports.products.summary.active)} actifs` },
        { label: "Stock faible", value: numberValue(reports.inventory.summary.lowStock).toString(), detail: `${numberValue(reports.inventory.summary.available)} unités disponibles` },
        { label: "Clients", value: numberValue(reports.customers.summary.count).toString(), detail: `${formatMoney(numberValue(reports.customers.summary.currentBalance))} solde` },
        { label: "Achats", value: formatMoney(numberValue(reports.purchases.summary.total)), detail: `${numberValue(reports.purchases.summary.count)} bons` },
        { label: "Profit brut", value: formatMoney(numberValue(reports.profit.summary.grossProfit)), detail: reports.profit.summary.marginReliable === false ? "Coût non renseigné sur certaines ventes" : `${numberValue(reports.profit.summary.marginRate)}% marge` }
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600">Business intelligence</p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Rapports</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Analyse des ventes, produits, stocks, clients, achats et profits.</p>
        </div>
        <details className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
          <summary className="cursor-pointer font-semibold">Mode expert</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => prepareExport("CSV")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Exporter CSV</button>
            <button onClick={() => prepareExport("Excel")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Exporter Excel</button>
            <button onClick={() => window.print()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Imprimer</button>
          </div>
        </details>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Date début
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Date fin
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <button onClick={() => void loadReports()} className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Filtrer</button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</p>
          </div>
        ))}
      </div>

      {isLoading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement des rapports...</div> : null}

      {!isLoading && reports ? (
        <div className="grid gap-5">
          {sections.map((section) => (
            <ReportTable key={section.key} config={section} report={reports[section.key]} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReportTable({ config, report }: { config: SectionConfig; report: ReportSection }) {
  const rows = config.key === "inventory" && report.recentMovements?.length ? report.items ?? [] : report.items ?? [];
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">{config.title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{config.description}</p>
        </div>
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{report.meta?.total ?? rows.length} lignes</div>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr>{config.columns.map((column) => <th key={column.key} className="p-3 font-semibold">{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-t border-slate-100 dark:border-slate-800">
                  {config.columns.map((column) => <td key={column.key} className="p-3 text-slate-700 dark:text-slate-200">{formatCell(row[column.key], column.format)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">{config.emptyText}</div>
      )}
    </section>
  );
}

function formatCell(value: Primitive, format?: Column["format"]) {
  if (value === null || value === undefined || value === "") return format === "money" ? "Coût non renseigné" : "--";
  if (format === "money") return formatMoney(Number(value));
  if (format === "date") return new Intl.DateTimeFormat("fr-HT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value)));
  if (format === "boolean") return value ? "Oui" : "Non";
  if (format === "status") return String(value).replaceAll("_", " ");
  return String(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(value);
}

function numberValue(value: ReportSummary[string]) {
  return typeof value === "number" ? value : 0;
}

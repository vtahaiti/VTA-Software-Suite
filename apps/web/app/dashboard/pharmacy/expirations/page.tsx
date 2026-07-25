"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";

type ExpirationRow = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  expirationDate: string;
  availableStock: number;
  warehouses: Array<{ warehouse: string; quantity: number }>;
};
type ExpirationsResponse = {
  expired: ExpirationRow[];
  expiringSoon: ExpirationRow[];
  ok: ExpirationRow[];
  summary: { expiredCount: number; expiringSoonCount: number; okCount: number; totalTracked: number };
};

export default function PharmacyExpirationsPage() {
  const [data, setData] = useState<ExpirationsResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/inventory/expirations`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossible de charger les lots et expirations.");
        setData(await response.json());
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Erreur de chargement."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Pharmacie</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Lots et expirations</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Produits en stock avec une date d&apos;expiration renseignée, triés par urgence. Les produits sans date d&apos;expiration ne sont pas suivis ici.</p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
      {isLoading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement...</div> : null}

      {!isLoading && data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="Expirés" value={data.summary.expiredCount} tone="red" />
            <SummaryCard label="Expirent sous 30 jours" value={data.summary.expiringSoonCount} tone="amber" />
            <SummaryCard label="Suivi OK" value={data.summary.okCount} tone="green" />
          </div>

          <ExpirationSection title="Expirés" tone="red" rows={data.expired} emptyText="Aucun produit expiré en stock." />
          <ExpirationSection title="Expirent sous 30 jours" tone="amber" rows={data.expiringSoon} emptyText="Aucun produit proche de l'expiration." />
          <ExpirationSection title="Suivi OK (plus de 30 jours)" tone="green" rows={data.ok} emptyText="Aucun produit dans cette catégorie." />
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "green" }) {
  const toneClasses = { red: "text-red-600 dark:text-red-400", amber: "text-amber-600 dark:text-amber-400", green: "text-emerald-600 dark:text-emerald-400" };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

function ExpirationSection({ title, tone, rows, emptyText }: { title: string; tone: "red" | "amber" | "green"; rows: ExpirationRow[]; emptyText: string }) {
  const headerToneClasses = { red: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950", amber: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950", green: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950" };
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`border-b p-4 ${headerToneClasses[tone]}`}>
        <h2 className="font-bold text-slate-950 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{rows.length} produit(s)</p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr><th className="p-3 font-semibold">Produit</th><th className="p-3 font-semibold">SKU</th><th className="p-3 font-semibold">Catégorie</th><th className="p-3 font-semibold">Expiration</th><th className="p-3 font-semibold">Stock disponible</th><th className="p-3 font-semibold">Dépôts</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-3 font-semibold text-slate-900 dark:text-white">{row.name}</td>
                  <td className="p-3 font-mono text-xs text-slate-500">{row.sku}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{row.category ?? "--"}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{new Date(row.expirationDate).toLocaleDateString("fr-HT")}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{row.availableStock}</td>
                  <td className="p-3 text-xs text-slate-500">{row.warehouses.map((w) => `${w.warehouse} (${w.quantity})`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>
      )}
    </section>
  );
}

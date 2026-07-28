"use client";

import { apiBaseUrl as apiUrl } from "@/lib/api-url";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";

type StockRow = {
  id: string;
  quantity: number;
  minimumStock: number;
  warehouse?: { id: string; name: string } | null;
  product: { id: string; name: string; sku: string };
};

type ZoneKey = "all" | "fridge" | "bar" | "kitchen" | "depot" | "supplies";

const ZONES: Array<{ key: ZoneKey; label: string; match: (name: string) => boolean }> = [
  { key: "all", label: "Tous", match: () => true },
  { key: "fridge", label: "Frigo / Congélateur", match: (name) => /réfrigérateur|refrigerateur|frigo|congélateur|congelateur/.test(name) },
  { key: "bar", label: "Bar / Boissons", match: (name) => name.includes("bar") },
  { key: "kitchen", label: "Cuisine / Ingrédients", match: (name) => name.includes("cuisine") },
  { key: "depot", label: "Dépôt / Réserves", match: (name) => /dépôt|depot/.test(name) },
  { key: "supplies", label: "Fournitures", match: (name) => name.includes("fourniture") }
];

export default function RestaurantStockPage() {
  const searchParams = useSearchParams();
  const requestedZone = searchParams.get("zone") as ZoneKey | null;
  const [zone, setZone] = useState<ZoneKey>(requestedZone && ZONES.some((item) => item.key === requestedZone) ? requestedZone : "all");
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/stock?limit=200`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossible de charger le stock Restaurant.");
        const data = await response.json();
        setStocks(Array.isArray(data) ? data : data.items ?? []);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Erreur de chargement."))
      .finally(() => setIsLoading(false));
  }, []);

  const activeZone = ZONES.find((item) => item.key === zone) ?? ZONES[0];
  const filteredStocks = useMemo(() => stocks.filter((stock) => activeZone.match((stock.warehouse?.name ?? "").toLowerCase())), [activeZone, stocks]);

  return <div className="space-y-5">
    <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Restaurant</p>
      <h1 className="text-2xl font-bold">Stock Restaurant</h1>
      <p className="mt-1 text-sm text-slate-500">Suivez les ingrédients, boissons, réserves et fournitures par zone.</p>
    </header>

    <nav className="flex flex-wrap gap-2" aria-label="Zones de stock">
      {ZONES.map((item) => <button key={item.key} type="button" onClick={() => setZone(item.key)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${zone === item.key ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950" : "border-slate-300 dark:border-slate-700"}`}>{item.label}</button>)}
    </nav>

    {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    {isLoading ? <div className="rounded-lg border p-6 text-sm text-slate-500 dark:border-slate-800">Chargement...</div> : null}

    {!isLoading && !error ? <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 className="font-bold">{activeZone.label}</h2>
        <p className="text-xs text-slate-500">{filteredStocks.length} article(s) suivi(s)</p>
      </div>
      {filteredStocks.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
            <tr><th className="p-3">Produit</th><th className="p-3">Zone</th><th className="p-3">Quantité</th><th className="p-3">Minimum</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>{filteredStocks.map((stock) => <tr key={stock.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="p-3 font-semibold">{stock.product.name}</td>
            <td className="p-3">{stock.warehouse?.name ?? "Dépôt principal"}</td>
            <td className="p-3">{stock.quantity}</td>
            <td className="p-3">{stock.minimumStock}</td>
            <td className="p-3"><StockStatus quantity={stock.quantity} minimum={stock.minimumStock} /></td>
            <td className="p-3"><div className="flex min-w-max flex-wrap gap-2">
              <Link href={`/dashboard/products/${stock.product.id}/edit`} className="rounded-md border px-3 py-2 text-xs font-semibold dark:border-slate-700">Modifier</Link>
              <Link href={`/dashboard/inventory?productId=${stock.product.id}&action=in`} className="rounded-md border border-green-200 px-3 py-2 text-xs font-semibold text-green-700">Entrée</Link>
              <Link href={`/dashboard/inventory?productId=${stock.product.id}&action=out`} className="rounded-md border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-700">Sortie</Link>
              <Link href={`/dashboard/inventory/movements?productId=${stock.product.id}`} className="rounded-md border px-3 py-2 text-xs font-semibold dark:border-slate-700">Historique</Link>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="p-6 text-sm text-slate-500">Aucun article suivi dans cette zone.</p>}
    </section> : null}
  </div>;
}

function StockStatus({ quantity, minimum }: { quantity: number; minimum: number }) {
  if (quantity <= 0) return <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Rupture</span>;
  if (quantity <= minimum) return <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Stock faible</span>;
  return <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">En stock</span>;
}

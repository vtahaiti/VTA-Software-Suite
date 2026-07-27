"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/api-client";

type Warehouse = { id: string; name: string };
type StockRow = {
  id: string;
  quantity: number;
  minimumStock: number;
  warehouseId: string;
  warehouse?: Warehouse | null;
  product: { id: string; name: string; sku: string };
};

type ZoneKey = "all" | "fridge" | "bar" | "kitchen" | "depot" | "supplies";

const ZONES: Array<{ key: ZoneKey; label: string; match: (warehouseName: string) => boolean; examples: string }> = [
  { key: "all", label: "Tous", match: () => true, examples: "" },
  {
    key: "fridge",
    label: "Frigo / Congélateur",
    match: (name) => name.includes("réfrigérateur") || name.includes("refrigerateur") || name.includes("frigo") || name.includes("congélateur") || name.includes("congelateur"),
    examples: "Exemples : viande, poisson, poulet, cabrit, légumes, jus frais, produits congelés."
  },
  {
    key: "bar",
    label: "Bar / Boissons",
    match: (name) => name.includes("bar"),
    examples: "Exemples : bière, soda, eau, jus en bouteille, rhum, vin."
  },
  {
    key: "kitchen",
    label: "Cuisine / Ingrédients",
    match: (name) => name.includes("cuisine"),
    examples: "Exemples : riz, huile, épices, farine, sauce tomate, sel, sucre, ail, oignon, piment."
  },
  {
    key: "depot",
    label: "Dépôt",
    match: (name) => name.includes("dépôt") || name.includes("depot"),
    examples: "Exemples : sac riz, gallon huile, caisse bière, carton eau."
  },
  {
    key: "supplies",
    label: "Fournitures",
    match: (name) => name.includes("fourniture"),
    examples: "Exemples : assiettes jetables, gobelets, serviettes, emballages."
  }
];

export default function RestaurantStockPage() {
  const searchParams = useSearchParams();
  const initialZone = (searchParams.get("zone") as ZoneKey) ?? "all";
  const [zone, setZone] = useState<ZoneKey>(ZONES.some((z) => z.key === initialZone) ? initialZone : "all");
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/stock?limit=200`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossible de charger le stock.");
        const data = await response.json();
        setStocks(data.items ?? []);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Erreur de chargement."))
      .finally(() => setIsLoading(false));
  }, []);

  const activeZone = ZONES.find((z) => z.key === zone) ?? ZONES[0];
  const filteredStocks = useMemo(() => {
    if (activeZone.key === "all") return stocks;
    return stocks.filter((stock) => activeZone.match((stock.warehouse?.name ?? "").toLowerCase()));
  }, [activeZone, stocks]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Restaurant</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Stock Restaurant</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Stock regroupé par zone : frigo, bar, cuisine, dépôt et fournitures.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ZONES.map((z) => (
          <button
            key={z.key}
            onClick={() => setZone(z.key)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${zone === z.key ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
          >
            {z.label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
      {isLoading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement...</div> : null}

      {!isLoading ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <h2 className="font-bold text-slate-950 dark:text-white">{activeZone.label}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{filteredStocks.length} produit(s)</p>
          </div>
          {filteredStocks.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr><th className="p-3 font-semibold">Produit</th><th className="p-3 font-semibold">Emplacement</th><th className="p-3 font-semibold">Quantité</th><th className="p-3 font-semibold">Minimum</th></tr>
                </thead>
                <tbody>
                  {filteredStocks.map((stock) => (
                    <tr key={stock.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">{stock.product.name}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{stock.warehouse?.name ?? "Dépôt principal"}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{stock.quantity}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{stock.minimumStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
              <p>Aucun produit dans cette zone pour le moment.</p>
              {activeZone.examples ? <p className="mt-2 text-xs">{activeZone.examples}</p> : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

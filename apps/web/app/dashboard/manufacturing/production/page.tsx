"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";

type Warehouse = { id: string; name: string };
type Product = { id: string; name: string; sku: string };
type Line = { productId: string; quantity: string };
type Movement = {
  id: string;
  quantity: number;
  reason: string | null;
  note: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  warehouse: { name: string };
};

const emptyLine: Line = { productId: "", quantity: "1" };

export default function ManufacturingProductionPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [inputs, setInputs] = useState<Line[]>([{ ...emptyLine }]);
  const [outputs, setOutputs] = useState<Line[]>([{ ...emptyLine }]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const [warehouseResponse, productRows, movementResponse] = await Promise.all([
        fetchWithAuth(`${apiUrl}/warehouses`),
        loadAllProducts(),
        fetchWithAuth(`${apiUrl}/inventory/movements?limit=20`)
      ]);
      if (!warehouseResponse.ok) throw new Error(await responseMessage(warehouseResponse, "Impossible de charger les dépôts."));
      if (!movementResponse.ok) throw new Error(await responseMessage(movementResponse, "Impossible de charger l'historique de production."));
      setWarehouses(await warehouseResponse.json());
      setProducts(productRows);
      setMovements(((await movementResponse.json()).items ?? []).filter((item: Movement) => (item.reason ?? "").startsWith("Production")));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger la production. Vérifiez votre connexion puis réessayez.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAllProducts() {
    const rows: Product[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const response = await fetchWithAuth(`${apiUrl}/products?limit=100&page=${page}`);
      if (!response.ok) throw new Error(await responseMessage(response, "Impossible de charger les produits."));
      const body = await response.json();
      rows.push(...(body.items ?? []));
      if (page >= Number(body.meta?.pageCount ?? 1)) break;
    }
    return rows;
  }

  function updateLine(list: Line[], setList: (lines: Line[]) => void, index: number, patch: Partial<Line>) {
    setList(list.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine(list: Line[], setList: (lines: Line[]) => void) {
    setList([...list, { ...emptyLine }]);
  }

  function removeLine(list: Line[], setList: (lines: Line[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index));
  }

  async function submit() {
    setError("");
    setSuccess("");
    const validInputs = inputs.filter((line) => line.productId && Number(line.quantity) > 0);
    const validOutputs = outputs.filter((line) => line.productId && Number(line.quantity) > 0);
    if (!warehouseId) { setError("Sélectionnez un entrepôt."); return; }
    if (!validInputs.length) { setError("Ajoutez au moins une matière première consommée."); return; }
    if (!validOutputs.length) { setError("Ajoutez au moins un produit fini obtenu."); return; }

    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth(`${apiUrl}/stock/produce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          note: note || undefined,
          inputs: validInputs.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
          outputs: validOutputs.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }))
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message || "Production impossible.");
        return;
      }
      setSuccess("Production enregistrée : stock des matières premières débité, produits finis crédités.");
      setInputs([{ ...emptyLine }]);
      setOutputs([{ ...emptyLine }]);
      setNote("");
      await load();
    } finally {
      setIsSubmitting(false);
    }
  }

  function productLabel(productId: string) {
    const product = products.find((item) => item.id === productId);
    return product ? `${product.name} (${product.sku})` : "";
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Fabrication</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Production</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enregistrez une production : les matières premières consommées sont débitées du stock et les produits finis obtenus y sont ajoutés, en une seule opération atomique dans le même entrepôt.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{success}</div> : null}

      {!isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-500">Entrepôt de production</label>
              <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                <option value="">Sélectionner...</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Note / référence</label>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex: Lot fenêtres aluminium #12" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <LineEditor
              title="Matières premières consommées"
              lines={inputs}
              products={products}
              productLabel={productLabel}
              onChange={(index, patch) => updateLine(inputs, setInputs, index, patch)}
              onAdd={() => addLine(inputs, setInputs)}
              onRemove={(index) => removeLine(inputs, setInputs, index)}
            />
            <LineEditor
              title="Produits finis obtenus"
              lines={outputs}
              products={products}
              productLabel={productLabel}
              onChange={(index, patch) => updateLine(outputs, setOutputs, index, patch)}
              onAdd={() => addLine(outputs, setOutputs)}
              onRemove={(index) => removeLine(outputs, setOutputs, index)}
            />
          </div>

          <button onClick={() => void submit()} disabled={isSubmitting} className="mt-6 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Enregistrement..." : "Enregistrer la production"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement...</div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="font-bold text-slate-950 dark:text-white">Dernières productions</h2>
        </div>
        {movements.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr><th className="p-3 font-semibold">Date</th><th className="p-3 font-semibold">Produit</th><th className="p-3 font-semibold">Entrepôt</th><th className="p-3 font-semibold">Mouvement</th><th className="p-3 font-semibold">Quantité</th></tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 text-slate-700 dark:text-slate-200">{new Date(movement.createdAt).toLocaleString("fr-HT")}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{movement.product.name}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{movement.warehouse.name}</td>
                    <td className="p-3 text-xs text-slate-500">{movement.reason}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{movement.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Aucune production enregistrée pour le moment.</div>
        )}
      </div>
    </div>
  );
}

async function responseMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.message) ? body.message[0] : body?.message ?? fallback;
}

function LineEditor({ title, lines, products, productLabel, onChange, onAdd, onRemove }: {
  title: string;
  lines: Line[];
  products: Product[];
  productLabel: (productId: string) => string;
  onChange: (index: number, patch: Partial<Line>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <div className="mt-2 space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="flex gap-2">
            <select value={line.productId} onChange={(event) => onChange(index, { productId: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Produit...</option>
              {products.map((product) => <option key={product.id} value={product.id}>{productLabel(product.id) || product.name}</option>)}
            </select>
            <input type="number" min="1" value={line.quantity} onChange={(event) => onChange(index, { quantity: event.target.value })} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <button onClick={() => onRemove(index)} className="rounded-md border px-3 py-2 text-xs font-semibold dark:border-slate-700">✕</button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="mt-2 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300">+ Ajouter une ligne</button>
    </div>
  );
}

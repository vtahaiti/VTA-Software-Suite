"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001");

type StockLine = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  minimumStock: number;
  stockTracked?: boolean;
  product?: {
    id: string;
    name: string;
    sku: string;
    salePrice?: string | number;
    category?: { name?: string | null } | null;
    unit?: { name?: string | null; symbol?: string | null } | null;
  } | null;
  warehouse?: { id: string; name: string; storeId?: string | null } | null;
};

type Warehouse = { id: string; name: string };
type StockAction = "in" | "out" | "adjust";
type StockOutReason = "CASSE" | "PERTE" | "UTILISATION_INTERNE" | "CORRECTION_INVENTAIRE" | "AUTRE";
type StockForm = { quantity: string; reason: StockOutReason | ""; note: string; cost: string; supplier: string };
type TransferForm = { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: string; note: string };

const emptyStockForm: StockForm = { quantity: "", reason: "", note: "", cost: "", supplier: "" };
const emptyTransferForm: TransferForm = { productId: "", fromWarehouseId: "", toWarehouseId: "", quantity: "1", note: "" };
const stockOutReasons: Array<{ value: StockOutReason; label: string }> = [
  { value: "PERTE", label: "Perte" },
  { value: "CASSE", label: "Casse" },
  { value: "UTILISATION_INTERNE", label: "Usage interne" },
  { value: "CORRECTION_INVENTAIRE", label: "Correction" },
  { value: "AUTRE", label: "Autre" }
];

export default function InventoryPage() {
  const [stocks, setStocks] = useState<StockLine[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [query, setQuery] = useState("");
  const [showNonStock, setShowNonStock] = useState(false);
  const [showAdvancedCorrection, setShowAdvancedCorrection] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockLine | null>(null);
  const [stockAction, setStockAction] = useState<StockAction>("in");
  const [stockForm, setStockForm] = useState<StockForm>(emptyStockForm);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>(emptyTransferForm);

  const summary = useMemo(() => {
    const tracked = stocks.filter((stock) => isStockTracked(stock));
    const outOfStock = tracked.filter((stock) => stock.quantity <= 0).length;
    const lowStock = tracked.filter((stock) => stock.quantity > 0 && stock.quantity <= Number(stock.minimumStock ?? 0)).length;
    const potentialValue = tracked.reduce((sum, stock) => sum + Number(stock.quantity ?? 0) * Number(stock.product?.salePrice ?? 0), 0);
    return { tracked: tracked.length, outOfStock, lowStock, potentialValue };
  }, [stocks]);
  const transferProducts = useMemo(() => {
    const seen = new Set<string>();
    return stocks.filter(isStockTracked).filter((stock) => {
      if (seen.has(stock.productId)) return false;
      seen.add(stock.productId);
      return true;
    });
  }, [stocks]);

  const loadStocks = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: "100", includeNonStock: showNonStock ? "true" : "false" });
    if (query.trim()) params.set("search", query.trim());
    const [stockResponse, warehouseResponse] = await Promise.all([
      fetch(`${apiUrl}/stock?${params.toString()}`, { headers: authHeaders() }).catch(() => null),
      fetch(`${apiUrl}/warehouses`, { headers: authHeaders() }).catch(() => null)
    ]);
    setIsLoading(false);
    if (!stockResponse?.ok) {
      setError("Impossible de charger l'inventaire.");
      return;
    }
    const data = await stockResponse.json();
    setStocks(data.items ?? []);
    if (warehouseResponse?.ok) setWarehouses(await warehouseResponse.json());
    setError("");
  }, [query, showNonStock]);

  useEffect(() => {
    const timer = setTimeout(() => void loadStocks(), 200);
    return () => clearTimeout(timer);
  }, [loadStocks]);

  function openStockModal(stock: StockLine, action: StockAction) {
    if (!isStockTracked(stock)) {
      setError("Cet article n'est pas suivi en stock.");
      return;
    }
    setSelectedStock(stock);
    setStockAction(action);
    setStockForm({ ...emptyStockForm, quantity: action === "adjust" ? String(stock.quantity) : "" });
    setError("");
    setMessage("");
  }

  function openTransfer(stock?: StockLine) {
    setTransferForm({
      ...emptyTransferForm,
      productId: stock?.productId ?? "",
      fromWarehouseId: stock?.warehouseId ?? ""
    });
    setIsTransferOpen(true);
    setError("");
    setMessage("");
  }

  async function saveStockAction() {
    if (!selectedStock) return;
    setError("");
    setMessage("");
    const quantity = Number(stockForm.quantity || 0);
    if (quantity < 0 || (stockAction !== "adjust" && quantity <= 0)) {
      setError("Quantité invalide.");
      return;
    }
    if (stockAction === "out" && !stockForm.reason) {
      setError("Choisissez un motif pour la sortie stock.");
      return;
    }
    const endpoint = stockAction === "adjust" ? "adjust" : stockAction;
    const noteParts = [stockForm.note.trim(), stockForm.cost ? `Coût: ${stockForm.cost}` : "", stockForm.supplier ? `Fournisseur: ${stockForm.supplier}` : ""].filter(Boolean);
    const response = await fetch(`${apiUrl}/stock/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        productId: selectedStock.productId,
        warehouseId: selectedStock.warehouseId,
        storeId: selectedStock.warehouse?.storeId ?? undefined,
        quantity,
        reason: stockAction === "out" ? stockForm.reason : undefined,
        note: noteParts.join(" - ") || actionLabel(stockAction)
      })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Action stock impossible.");
      return;
    }
    setSelectedStock(null);
    setStockForm(emptyStockForm);
    setMessage(`${actionLabel(stockAction)} enregistrée.`);
    await loadStocks();
  }

  async function saveTransfer() {
    setError("");
    setMessage("");
    if (!transferForm.productId || !transferForm.fromWarehouseId || !transferForm.toWarehouseId) {
      setError("Produit, dépôt source et dépôt destination sont obligatoires.");
      return;
    }
    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
      setError("Le dépôt source et la destination doivent être différents.");
      return;
    }
    const response = await fetch(`${apiUrl}/inventory/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        fromWarehouseId: transferForm.fromWarehouseId,
        toWarehouseId: transferForm.toWarehouseId,
        note: transferForm.note.trim() || undefined,
        items: [{ productId: transferForm.productId, quantity: Number(transferForm.quantity || 0) }]
      })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Transfert impossible.");
      return;
    }
    setIsTransferOpen(false);
    setTransferForm(emptyTransferForm);
    setMessage("Transfert stock enregistré.");
    await loadStocks();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-brand-600">Inventaire</p>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Mouvements et contrôle stock</h1>
            <p className="mt-1 text-sm text-slate-500">Les produits se gèrent dans le catalogue. Ici, suivez les entrées, sorties, transferts et historiques de stock.</p>
            <p className="mt-1 text-xs text-slate-500">Restaurant : Dépôt principal, Réfrigérateur, Cuisine, Bar. Market, Quincaillerie et Pharmacie : Dépôt principal.</p>
          </div>
          <Link href="/dashboard/products" className="rounded-md border border-slate-300 px-4 py-3 text-center text-sm font-bold dark:border-slate-700">Ouvrir le catalogue</Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Produits suivis" value={summary.tracked} />
        <SummaryCard label="Ruptures" value={summary.outOfStock} tone="red" />
        <SummaryCard label="Stock faible" value={summary.lowStock} tone="amber" />
        <SummaryCard label="Valeur potentielle du stock" value={formatMoney(summary.potentialValue)} helper="Prix de vente × quantité. Ce n'est pas le bénéfice." />
      </section>

      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error} <button type="button" onClick={() => void loadStocks()} className="ml-2 font-bold underline">Réessayer</button></div> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher produit ou SKU" className="rounded-md border border-slate-300 px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
        <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-700">
          <input type="checkbox" checked={showNonStock} onChange={(event) => setShowNonStock(event.target.checked)} />
          Afficher les articles non suivis
        </label>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
            <tr>
              <th className="p-3">Produit</th>
              <th className="p-3">Catégorie</th>
              <th className="p-3">Emplacement</th>
              <th className="p-3">Quantité actuelle</th>
              <th className="p-3">Minimum</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3">
                  <p className="font-semibold">{stock.product?.name ?? "Produit"}</p>
                  <p className="text-xs text-slate-500">{stock.product?.sku}{unitLabel(stock) ? ` - ${unitLabel(stock)}` : ""}</p>
                </td>
                <td className="p-3">{stock.product?.category?.name ?? "-"}</td>
                <td className="p-3">{stock.warehouse?.name ?? "Dépôt principal"}</td>
                <td className="p-3 text-lg font-bold">{isStockTracked(stock) ? `${stock.quantity}${unitLabel(stock) ? ` ${unitLabel(stock)}` : ""}` : "Non suivi"}</td>
                <td className="p-3">{isStockTracked(stock) ? stock.minimumStock : "-"}</td>
                <td className="p-3"><StockStatusBadge stock={stock} /></td>
                <td className="p-3">
                  {isStockTracked(stock) ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openStockModal(stock, "in")} className="rounded-md border border-green-200 px-3 py-2 text-sm font-semibold text-green-700 dark:border-green-900">Entrée stock</button>
                      <button type="button" onClick={() => openStockModal(stock, "out")} className="rounded-md border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 dark:border-orange-900">Sortie stock</button>
                      <button type="button" onClick={() => openTransfer(stock)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Transfert</button>
                      <Link href={`/dashboard/inventory/movements?productId=${stock.productId}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Historique</Link>
                    </div>
                  ) : <span className="text-sm font-semibold text-slate-500">Article non suivi</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !error && !stocks.length ? <p className="p-5 text-sm text-slate-500">Aucun produit suivi en stock. Activez le filtre secondaire pour voir les articles non suivis.</p> : null}
        {isLoading ? <p className="p-5 text-sm text-slate-500">Chargement de l&apos;inventaire...</p> : null}
      </section>

      <details open={showAdvancedCorrection} onToggle={(event) => setShowAdvancedCorrection(event.currentTarget.open)} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-200">Options avancées</summary>
        <p className="mt-2 text-sm text-slate-500">Correction inventaire : utilisez cette action seulement après comptage ou erreur de saisie, avec une note claire.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {stocks.filter(isStockTracked).slice(0, 5).map((stock) => (
            <button key={stock.id} type="button" onClick={() => openStockModal(stock, "adjust")} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Corriger {stock.product?.name}</button>
          ))}
        </div>
      </details>

      {selectedStock ? <StockModal stock={selectedStock} action={stockAction} form={stockForm} setForm={setStockForm} onClose={() => setSelectedStock(null)} onSave={saveStockAction} /> : null}
      {isTransferOpen ? <TransferModal form={transferForm} setForm={setTransferForm} stocks={transferProducts} warehouses={warehouses} onClose={() => setIsTransferOpen(false)} onSave={saveTransfer} /> : null}
    </div>
  );
}

function SummaryCard({ label, value, helper, tone = "slate" }: { label: string; value: string | number; helper?: string; tone?: "slate" | "red" | "amber" }) {
  const toneClass = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-slate-950 dark:text-white";
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <p className="text-sm text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
  </div>;
}

function StockModal({ stock, action, form, setForm, onClose, onSave }: { stock: StockLine; action: StockAction; form: StockForm; setForm: (form: StockForm) => void; onClose: () => void; onSave: () => void }) {
  const title = action === "adjust" ? "Correction inventaire" : action === "in" ? "Entrée stock" : "Sortie stock";
  const quantityLabel = action === "adjust" ? "Quantité comptée" : action === "in" ? "Quantité entrée" : "Quantité sortie";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-slate-500">{stock.product?.name} - quantité actuelle {stock.quantity}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
        </div>
        <div className="mt-4 grid gap-3">
          <ModalInput label={quantityLabel} value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} type="number" />
          {action === "in" ? (
            <>
              <ModalInput label="Coût facultatif" value={form.cost} onChange={(value) => setForm({ ...form, cost: value })} type="number" />
              <ModalInput label="Fournisseur facultatif" value={form.supplier} onChange={(value) => setForm({ ...form, supplier: value })} />
            </>
          ) : null}
          {action === "out" ? (
            <label className="grid gap-1 text-sm font-semibold">Motif obligatoire
              <select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value as StockOutReason })} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950">
                <option value="">Choisir un motif</option>
                {stockOutReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
            </label>
          ) : null}
          <ModalInput label="Note facultative" value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
          {action === "out" ? <p className="rounded-md bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800">Cette sortie est non commerciale : elle ne crée aucune vente.</p> : null}
          <button type="button" onClick={() => void onSave()} className="rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ form, setForm, stocks, warehouses, onClose, onSave }: { form: TransferForm; setForm: (form: TransferForm) => void; stocks: StockLine[]; warehouses: Warehouse[]; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">Transfert stock</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
        </div>
        <div className="mt-4 grid gap-3">
          <Select label="Produit" value={form.productId} onChange={(value) => setForm({ ...form, productId: value })} items={stocks.map((stock) => ({ id: stock.productId, name: stock.product?.name ?? "Produit" }))} />
          <Select label="Emplacement source" value={form.fromWarehouseId} onChange={(value) => setForm({ ...form, fromWarehouseId: value })} items={warehouses} />
          <Select label="Emplacement destination" value={form.toWarehouseId} onChange={(value) => setForm({ ...form, toWarehouseId: value })} items={warehouses} />
          <ModalInput label="Quantité" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} type="number" />
          <ModalInput label="Note facultative" value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Le transfert déplace le stock entre emplacements sans changer la quantité globale.</p>
          <button type="button" onClick={() => void onSave()} className="rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">Enregistrer le transfert</button>
        </div>
      </div>
    </div>
  );
}

function ModalInput({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-semibold">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>;
}

function Select({ label, value, onChange, items }: { label: string; value: string; items: Array<{ id: string; name: string }>; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-semibold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"><option value="">Choisir</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function actionLabel(action: StockAction) {
  if (action === "adjust") return "Correction inventaire";
  if (action === "in") return "Entrée stock";
  return "Sortie stock";
}

function StockStatusBadge({ stock }: { stock: StockLine }) {
  if (!isStockTracked(stock)) return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Non suivi</span>;
  if (stock.quantity <= 0) return <span className="inline-flex rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Rupture</span>;
  if (stock.quantity <= Number(stock.minimumStock ?? 0)) return <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Stock faible</span>;
  return <span className="inline-flex rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700">En stock</span>;
}

function isStockTracked(stock: Pick<StockLine, "stockTracked">) {
  return stock.stockTracked !== false;
}

function unitLabel(stock: StockLine) {
  const value = (stock.product?.unit?.symbol ?? stock.product?.unit?.name ?? "").trim();
  return Boolean(value) && !/^\d+(?:[.,]\d+)?$/.test(value) ? value : "";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(value);
}

function authHeaders() {
  return { Authorization: `Bearer ${getAccessToken()}` };
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Opération impossible";
  } catch {
    return "Opération impossible";
  }
}

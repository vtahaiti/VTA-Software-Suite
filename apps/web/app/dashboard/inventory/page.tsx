"use client";

import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

type StockLine = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  minimumStock: number;
  stockTracked?: boolean;
  product?: { id: string; name: string; sku: string; salePrice?: string | number; minimumStock?: number; unit?: { name?: string | null; symbol?: string | null } | null; supplier?: { name?: string | null } | null } | null;
  warehouse?: { id: string; name: string; storeId?: string | null } | null;
};
type ProductForm = { name: string; salePrice: string; purchasePrice: string; stockInitial: string; minimumStock: string };
type StockAction = "adjust" | "in" | "out";
type StockForm = { quantity: string; note: string };

const emptyProductForm: ProductForm = { name: "", salePrice: "", purchasePrice: "", stockInitial: "", minimumStock: "0" };
const emptyStockForm: StockForm = { quantity: "", note: "" };

export default function InventoryPage() {
  const [stocks, setStocks] = useState<StockLine[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockLine | null>(null);
  const [stockAction, setStockAction] = useState<StockAction>("adjust");
  const [stockForm, setStockForm] = useState<StockForm>(emptyStockForm);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);

  useEffect(() => {
    const timer = setTimeout(() => void loadStocks(), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const lowStockCount = useMemo(() => stocks.filter((stock) => isStockTracked(stock) && stock.quantity <= stock.minimumStock).length, [stocks]);

  async function loadStocks() {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (query.trim()) params.set("search", query.trim());
    const response = await fetch(`${apiUrl}/stock?${params.toString()}`, { headers: authHeaders() }).catch(() => null);
    setIsLoading(false);
    if (!response?.ok) {
      setError("Impossible de charger le stock.");
      return;
    }
    const data = await response.json();
    setStocks(data.items ?? []);
    setError("");
  }

  function openStockModal(stock: StockLine, action: StockAction) {
    setSelectedStock(stock);
    setStockAction(action);
    setStockForm({ quantity: action === "adjust" ? String(stock.quantity) : "", note: "" });
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
    const endpoint = stockAction === "adjust" ? "adjust" : stockAction;
    const response = await fetch(`${apiUrl}/stock/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        productId: selectedStock.productId,
        warehouseId: selectedStock.warehouseId,
        storeId: selectedStock.warehouse?.storeId ?? undefined,
        quantity,
        note: stockForm.note.trim() || actionLabel(stockAction)
      })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Action stock impossible.");
      return;
    }
    setSelectedStock(null);
    setStockForm(emptyStockForm);
    setMessage("Stock mis à jour.");
    await loadStocks();
  }

  async function createProduct() {
    setError("");
    setMessage("");
    if (!productForm.name.trim()) {
      setError("Nom du produit obligatoire.");
      return;
    }
    const response = await fetch(`${apiUrl}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        name: productForm.name.trim(),
        salePrice: Number(productForm.salePrice || 0),
        purchasePrice: Number(productForm.purchasePrice || 0),
        minimumStock: Number(productForm.minimumStock || 0),
        stockInitial: Number(productForm.stockInitial || 0)
      })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Création produit impossible.");
      return;
    }
    setProductForm(emptyProductForm);
    setShowProductModal(false);
    setMessage("Produit créé.");
    await loadStocks();
  }

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600">Stock</p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Inventaire simple</h1>
          <p className="mt-1 text-sm text-slate-500">Recherchez un produit, ajustez, ajoutez ou retirez du stock.</p>
        </div>
        <button onClick={() => setShowProductModal(true)} className="rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">Nouveau produit</button>
      </div>
    </section>

    {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error} <button type="button" onClick={() => void loadStocks()} className="ml-2 font-bold underline">Réessayer</button></div> : null}
    {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_auto]">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher produit ou SKU" className="rounded-md border border-slate-300 px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
      <div className="rounded-md bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200">Stock faible: {lowStockCount}</div>
    </section>

    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
          <tr><th className="p-3">Produit</th><th className="p-3">Dépôt</th><th className="p-3">Stock actuel</th><th className="p-3">Statut</th><th className="p-3">Stock minimum</th><th className="p-3">Fournisseur</th><th className="p-3">Actions</th></tr>
        </thead>
        <tbody>
          {stocks.map((stock) => <tr key={stock.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="p-3"><p className="font-semibold">{stock.product?.name ?? "Produit"}</p><p className="text-xs text-slate-500">{stock.product?.sku}{unitLabel(stock) ? ` · ${unitLabel(stock)}` : ""}</p></td>
            <td className="p-3">{stock.warehouse?.name ?? "-"}</td>
            <td className="p-3 text-lg font-bold">{stock.quantity}{unitLabel(stock) ? ` ${unitLabel(stock)}` : ""}</td>
            <td className="p-3"><StockStatusBadge stock={stock} /></td>
            <td className="p-3">{stock.minimumStock}</td>
            <td className="p-3">{stock.product?.supplier?.name ?? "-"}</td>
            <td className="p-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openStockModal(stock, "adjust")} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Ajuster</button>
                <button onClick={() => openStockModal(stock, "in")} className="rounded-md border border-green-200 px-3 py-2 text-sm font-semibold text-green-700 dark:border-green-900">Entrée stock</button>
                <button onClick={() => openStockModal(stock, "out")} className="rounded-md border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 dark:border-orange-900">Sortie stock</button>
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>
      {!isLoading && !error && !stocks.length ? <p className="p-5 text-sm text-slate-500">Aucun stock trouvé.</p> : null}
      {isLoading ? <p className="p-5 text-sm text-slate-500">Chargement du stock...</p> : null}
    </section>

    {selectedStock ? <StockModal stock={selectedStock} action={stockAction} form={stockForm} setForm={setStockForm} onClose={() => setSelectedStock(null)} onSave={saveStockAction} /> : null}
    {showProductModal ? <ProductModal form={productForm} setForm={setProductForm} onClose={() => setShowProductModal(false)} onSave={createProduct} /> : null}
  </div>;
}

function StockModal({ stock, action, form, setForm, onClose, onSave }: { stock: StockLine; action: StockAction; form: StockForm; setForm: (form: StockForm) => void; onClose: () => void; onSave: () => void }) {
  const title = action === "adjust" ? "Ajuster le stock" : action === "in" ? "Entrée stock" : "Sortie stock";
  const quantityLabel = action === "adjust" ? "Nouvelle quantité" : action === "in" ? "Quantité ajoutée" : "Quantité retirée";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-slate-500">{stock.product?.name} - stock actuel {stock.quantity}</p>
        </div>
        <button onClick={onClose} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
      </div>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">{quantityLabel}
          <input type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Motif
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ex: comptage, casse, retour, correction" className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <button onClick={() => void onSave()} className="rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">Enregistrer</button>
      </div>
    </div>
  </div>;
}

function ProductModal({ form, setForm, onClose, onSave }: { form: ProductForm; setForm: (form: ProductForm) => void; onClose: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold">Nouveau produit</h2>
        <button onClick={onClose} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
      </div>
      <div className="mt-4 grid gap-3">
        <ModalInput label="Nom *" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
        <ModalInput label="Prix d'achat" value={form.purchasePrice} onChange={(value) => setForm({ ...form, purchasePrice: value })} type="number" />
        <ModalInput label="Prix de vente" value={form.salePrice} onChange={(value) => setForm({ ...form, salePrice: value })} type="number" />
        <ModalInput label="Stock initial" value={form.stockInitial} onChange={(value) => setForm({ ...form, stockInitial: value })} type="number" />
        <ModalInput label="Seuil stock faible" value={form.minimumStock} onChange={(value) => setForm({ ...form, minimumStock: value })} type="number" />
        <button onClick={() => void onSave()} className="rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">Créer</button>
      </div>
    </div>
  </div>;
}

function ModalInput({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-semibold">{label}
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
  </label>;
}

function actionLabel(action: StockAction) {
  if (action === "adjust") return "Ajustement manuel";
  if (action === "in") return "Entrée stock";
  return "Sortie stock";
}

function stockStatus(stock: Pick<StockLine, "quantity" | "minimumStock" | "stockTracked">) {
  if (!isStockTracked(stock)) return "NON_STOCK";
  if (stock.quantity <= 0) return "OUT_OF_STOCK";
  if (stock.quantity <= stock.minimumStock) return "LOW_STOCK";
  return "IN_STOCK";
}

function StockStatusBadge({ stock }: { stock: StockLine }) {
  const status = stockStatus(stock);
  if (status === "NON_STOCK") return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Service / non stocké</span>;
  if (status === "OUT_OF_STOCK") return <span className="inline-flex rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Rupture</span>;
  if (status === "LOW_STOCK") return <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Stock faible</span>;
  return <span className="inline-flex rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700">En stock</span>;
}

function isStockTracked(stock: Pick<StockLine, "stockTracked" | "minimumStock">) {
  return stock.stockTracked === true || (stock.stockTracked !== false && Number(stock.minimumStock ?? 0) > 0);
}

function unitLabel(stock: StockLine) {
  return stock.product?.unit?.symbol ?? stock.product?.unit?.name ?? "";
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

"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

type Product = {
  id: string;
  sku: string;
  name: string;
  salePrice: string;
  purchasePrice?: string | number;
  averageCost?: string | number;
  costKnown?: boolean;
  stockCurrent?: number;
  category?: { name: string } | null;
  unit?: { name?: string | null; symbol?: string | null } | null;
  supplier?: { name?: string | null } | null;
  minimumStock: number;
};
type Category = { id: string; name: string };
type ProductForm = { name: string; purchasePrice: string; salePrice: string; categoryId: string; stockInitial: string; minimumStock: string; imageUrl: string };

const emptyForm: ProductForm = { name: "", purchasePrice: "", salePrice: "", categoryId: "", stockInitial: "", minimumStock: "0", imageUrl: "" };

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [costMissingOnly, setCostMissingOnly] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [quickCostProduct, setQuickCostProduct] = useState<Product | null>(null);
  const [quickCostValue, setQuickCostValue] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function loadCategories() {
    const response = await fetchWithAuth(`${apiUrl}/products/categories`);
    if (response.ok) setCategories(await response.json());
  }

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    const params = new URLSearchParams({ page: String(page), limit: "25", sortBy: "createdAt", sortOrder: "desc", isActive: "true" });
    if (search.trim()) params.set("search", search.trim());
    if (costMissingOnly) params.set("costMissing", "true");
    const response = await fetchWithAuth(`${apiUrl}/products?${params}`).catch(() => null);
    setIsLoading(false);
    if (response?.ok) {
      const data = await response.json();
      const nextItems = Array.isArray(data) ? data : data.items ?? [];
      setItems(nextItems);
      setTotal(data.meta?.total ?? nextItems.length);
      return;
    }
    setItems([]);
    setTotal(0);
    setMessage(response ? await readError(response) : "Impossible de charger les produits.");
  }, [costMissingOnly, page, search]);

  useEffect(() => { void loadCategories(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => void loadProducts(), 250);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);
    const response = await fetchWithAuth(`${apiUrl}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        salePrice: Number(form.salePrice || 0),
        purchasePrice: Number(form.purchasePrice || 0),
        categoryId: form.categoryId || undefined,
        minimumStock: Number(form.minimumStock || 0),
        stockInitial: Number(form.stockInitial || 0),
        images: form.imageUrl ? [{ url: form.imageUrl, alt: form.name, sortOrder: 0 }] : undefined,
        isActive: true
      })
    });
    setIsSaving(false);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    setForm(emptyForm);
    setIsModalOpen(false);
    await loadProducts();
  }

  async function saveQuickCost(event: FormEvent) {
    event.preventDefault();
    if (!quickCostProduct) return;
    setMessage("");
    setIsSaving(true);
    const response = await fetchWithAuth(`${apiUrl}/products/${quickCostProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchasePrice: Number(quickCostValue || 0) })
    });
    setIsSaving(false);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    setMessage(`Coût d'achat mis à jour pour ${quickCostProduct.name}.`);
    setQuickCostProduct(null);
    setQuickCostValue("");
    await loadProducts();
  }

  function openQuickCost(product: Product) {
    setQuickCostProduct(product);
    setQuickCostValue(String(product.purchasePrice ?? ""));
  }

  const pages = useMemo(() => Math.max(1, Math.ceil(total / 25)), [total]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Produits</h1>
        <button onClick={() => setIsModalOpen(true)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Nouveau produit</button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher un produit" className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={costMissingOnly} onChange={(event) => { setCostMissingOnly(event.target.checked); setPage(1); }} />
          Coût manquant
        </label>
        <button onClick={() => setShowOptions((value) => !value)} className="mt-3 text-sm font-semibold text-slate-500 hover:text-brand-600">Plus d&apos;options</button>
        {showOptions ? <div className="mt-3 flex flex-wrap gap-2 text-sm"><Link href="/dashboard/import-export" className="rounded-md border px-3 py-2 dark:border-slate-700">Import / Export</Link><Link href="/dashboard/products/create" className="rounded-md border px-3 py-2 dark:border-slate-700">Fiche produit avancée</Link><Link href="/dashboard/products/categories" className="rounded-md border px-3 py-2 dark:border-slate-700">Catégories</Link></div> : null}
      </div>
      {message ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message} <button type="button" onClick={() => void loadProducts()} className="ml-2 font-bold underline">Réessayer</button></div> : null}

      <div className="grid gap-3 md:hidden">
        {items.map((product) => <article key={product.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-slate-950 dark:text-white">{product.name}</h2>
              <p className="font-mono text-xs text-slate-400">{product.sku || "SKU auto"}{productUnitLabel(product) ? ` - ${productUnitLabel(product)}` : ""}</p>
              {isProductStockTracked(product) ? <p className="text-xs text-slate-500">Seuil min. {product.minimumStock ?? 0}</p> : null}
              <p className="mt-1 text-sm text-slate-500">{product.category?.name ?? "Sans catégorie"}</p>
            </div>
            <p className="shrink-0 text-right text-sm font-bold text-slate-950 dark:text-white">{product.salePrice}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">Stock</span><p className="font-semibold">{productStockDisplay(product)}</p><ProductStockStatus product={product} /></div>
            <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">Fournisseur</span><p className="truncate font-semibold">{product.supplier?.name ?? "--"}</p></div>
          </div>
          {product.costKnown === false ? <div className="mt-2 flex flex-wrap items-center gap-2"><p className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Coût non renseigné</p><button type="button" onClick={() => openQuickCost(product)} className="rounded-md border border-amber-200 px-2 py-1 text-xs font-bold text-amber-700">Ajouter coût</button></div> : <button type="button" onClick={() => openQuickCost(product)} className="mt-2 text-xs font-semibold text-slate-500 underline">Modifier coût</button>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link className="rounded-md bg-brand-600 px-3 py-3 text-center text-sm font-bold text-white" href={`/dashboard/products/${product.id}/edit`}>Modifier</Link>
            <Link className="rounded-md border border-slate-300 px-3 py-3 text-center text-sm font-semibold dark:border-slate-700" href={`/dashboard/products/${product.id}/edit`}>Voir</Link>
          </div>
        </article>)}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Produit</th><th className="p-3">Catégorie</th><th className="p-3">Prix</th><th className="p-3">Stock</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{items.map((product) => <tr key={product.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3"><p className="font-semibold">{product.name}</p><p className="font-mono text-xs text-slate-400">{product.sku}{productUnitLabel(product) ? ` - ${productUnitLabel(product)}` : ""}</p>{isProductStockTracked(product) ? <p className="text-xs text-slate-500">Seuil min. {product.minimumStock ?? 0}</p> : null}{product.supplier?.name ? <p className="text-xs text-slate-500">Fournisseur: {product.supplier.name}</p> : null}{product.costKnown === false ? <p className="mt-1 text-xs font-semibold text-amber-600">Coût non renseigné</p> : null}</td><td className="p-3">{product.category?.name ?? "--"}</td><td className="p-3">{product.salePrice}</td><td className="p-3"><p className="font-semibold">{productStockDisplay(product)}</p><ProductStockStatus product={product} /></td><td className="p-3"><div className="flex flex-wrap gap-3"><Link className="text-brand-600" href={`/dashboard/products/${product.id}/edit`}>Modifier</Link><button type="button" onClick={() => openQuickCost(product)} className="text-amber-700">Coût</button></div></td></tr>)}</tbody>
        </table>
        {!isLoading && !message && items.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucun produit trouvé.</p> : null}
        {isLoading ? <p className="p-5 text-sm text-slate-500">Chargement des produits...</p> : null}
      </div>

      <Pagination page={page} pages={pages} total={total} label="produits" onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />

      {isModalOpen ? (
        <Modal title="Nouveau produit" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={createProduct} className="space-y-3">
            <Input required value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Nom *" />
            <Input type="number" value={form.purchasePrice} onChange={(value) => setForm((current) => ({ ...current, purchasePrice: value }))} placeholder="Coût d'achat" />
            <Input required type="number" value={form.salePrice} onChange={(value) => setForm((current) => ({ ...current, salePrice: value }))} placeholder="Prix *" />
            <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Catégorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <Input type="number" value={form.stockInitial} onChange={(value) => setForm((current) => ({ ...current, stockInitial: value }))} placeholder="Stock initial" />
            <Input type="number" value={form.minimumStock} onChange={(value) => setForm((current) => ({ ...current, minimumStock: value }))} placeholder="Seuil stock faible" />
            <label className="grid gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              Choisir une image
              <input type="file" accept="image/*" onChange={(event) => void loadImage(event.target.files?.[0], (value) => setForm((current) => ({ ...current, imageUrl: value })))} className="sr-only" />
              {form.imageUrl ? <span className="text-xs font-normal text-green-600">Image sélectionnée</span> : <span className="text-xs font-normal text-slate-400">Facultatif</span>}
            </label>
            <p className="text-xs text-slate-500">Le stock initial crée la quantité de départ du produit. Les autres entrées restent dans le module Stock.</p>
            {message ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
            <button disabled={isSaving} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "Enregistrement..." : "Enregistrer"}</button>
          </form>
        </Modal>
      ) : null}
      {quickCostProduct ? (
        <Modal title="Modifier le coût d'achat" onClose={() => { setQuickCostProduct(null); setQuickCostValue(""); }}>
          <form onSubmit={saveQuickCost} className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{quickCostProduct.name}</p>
            <Input required type="number" value={quickCostValue} onChange={setQuickCostValue} placeholder="Coût d'achat" />
            <p className="text-xs text-slate-500">Met à jour uniquement le coût d&apos;achat du produit. Le prix de vente, le stock et les ventes ne changent pas.</p>
            <button disabled={isSaving} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "Enregistrement..." : "Enregistrer le coût"}</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="rounded-md border px-3 py-1 text-sm dark:border-slate-700">Fermer</button></div>{children}</div></div>;
}

function Input({ value, onChange, placeholder, required = false, type = "text" }: { value: string; placeholder: string; required?: boolean; type?: string; onChange: (value: string) => void }) {
  return <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />;
}

function Pagination({ page, pages, total, label, onPrev, onNext }: { page: number; pages: number; total: number; label: string; onPrev: () => void; onNext: () => void }) {
  return <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{total} {label}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={onPrev} className="rounded-md border px-3 py-2 disabled:opacity-50">Précédent</button><span className="px-3 py-2 text-sm">{page}/{pages}</span><button disabled={page >= pages} onClick={onNext} className="rounded-md border px-3 py-2 disabled:opacity-50">Suivant</button></div></div>;
}

function productUnitLabel(product: Pick<Product, "unit">) {
  const value = (product.unit?.symbol ?? product.unit?.name ?? "").trim();
  return isReadableUnitLabel(value) ? value : "";
}

function isReadableUnitLabel(value: string) {
  return Boolean(value) && !/^\d+(?:[.,]\d+)?$/.test(value);
}

function isProductStockTracked(product: Pick<Product, "stockCurrent" | "minimumStock">) {
  return Number(product.stockCurrent ?? 0) > 0 || Number(product.minimumStock ?? 0) > 0;
}

function productStockStatus(product: Pick<Product, "stockCurrent" | "minimumStock">) {
  if (!isProductStockTracked(product)) return "NON_STOCK";
  const current = Number(product.stockCurrent ?? 0);
  const minimum = Number(product.minimumStock ?? 0);
  if (current <= 0) return "OUT_OF_STOCK";
  if (current <= minimum) return "LOW_STOCK";
  return "IN_STOCK";
}

function productStockDisplay(product: Pick<Product, "stockCurrent" | "minimumStock" | "unit">) {
  if (!isProductStockTracked(product)) return "Non stocke";
  const unit = productUnitLabel(product);
  const current = `${product.stockCurrent ?? 0}${unit ? ` ${unit}` : ""}`;
  return `${current} - min. ${product.minimumStock ?? 0}`;
}

function ProductStockStatus({ product }: { product: Product }) {
  const status = productStockStatus(product);
  if (status === "NON_STOCK") return <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Service / non stocke</span>;
  if (status === "OUT_OF_STOCK") return <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Rupture</span>;
  if (status === "LOW_STOCK") return <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Stock faible</span>;
  return <span className="mt-1 inline-flex rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700">En stock</span>;
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Enregistrement impossible.";
}

function loadImage(file: File | undefined, onDone: (value: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result));
  reader.readAsDataURL(file);
}

"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/company-branding";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));
const PAGE_SIZE = 25;

type Product = {
  id: string;
  name: string;
  salePrice: string | number;
  stockCurrent?: number;
  minimumStock?: number;
  category?: { name: string } | null;
  images?: Array<{ url?: string | null; alt?: string | null }>;
};

type Category = { id: string; name: string };
type ProductForm = {
  name: string;
  purchasePrice: string;
  salePrice: string;
  categoryId: string;
  stockInitial: string;
  minimumStock: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
};

const emptyForm: ProductForm = {
  name: "",
  purchasePrice: "",
  salePrice: "",
  categoryId: "",
  stockInitial: "",
  minimumStock: "0",
  description: "",
  imageUrl: "",
  isActive: true
};

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
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
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy: "createdAt", sortOrder: "desc", isActive: "true" });
    if (search.trim()) params.set("search", search.trim());
    const response = await fetchWithAuth(`${apiUrl}/products?${params}`).catch(() => null);
    setIsLoading(false);
    if (response?.ok) {
      const data = await response.json();
      const nextItems = Array.isArray(data) ? data : data.items ?? [];
      setItems(nextItems);
      setTotal(Math.max(Number(data.meta?.total ?? 0), nextItems.length));
      return;
    }
    setItems([]);
    setTotal(0);
    setMessage(response ? await readError(response) : "Impossible de charger les produits.");
  }, [page, search]);

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
        name: form.name.trim(),
        purchasePrice: Number(form.purchasePrice || 0),
        salePrice: Number(form.salePrice || 0),
        categoryId: form.categoryId || undefined,
        stockInitial: Number(form.stockInitial || 0),
        minimumStock: Number(form.minimumStock || 0),
        description: form.description.trim() || undefined,
        images: form.imageUrl ? [{ url: form.imageUrl, alt: form.name, sortOrder: 0 }] : undefined,
        isActive: form.isActive
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

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm("Supprimer ce produit ? Cette action ne doit pas supprimer les anciennes ventes.");
    if (!confirmed) return;
    setMessage("");
    const response = await fetchWithAuth(`${apiUrl}/products/${product.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setMessage(response ? await readError(response) : "Suppression impossible.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== product.id));
    setTotal((current) => Math.max(0, current - 1));
  }

  const displayTotal = Math.max(total, items.length);
  const pages = useMemo(() => Math.max(1, Math.ceil(displayTotal / PAGE_SIZE)), [displayTotal]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Produits</h1>
        <button onClick={() => setIsModalOpen(true)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Nouveau produit</button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher un produit" className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <button onClick={() => setShowOptions((value) => !value)} className="mt-3 text-sm font-semibold text-slate-500 hover:text-brand-600">Plus d&apos;options</button>
        {showOptions ? <div className="mt-3 flex flex-wrap gap-2 text-sm"><Link href="/dashboard/import-export" className="rounded-md border px-3 py-2 dark:border-slate-700">Import / Export</Link><Link href="/dashboard/products/create" className="rounded-md border px-3 py-2 dark:border-slate-700">Fiche produit avancée</Link><Link href="/dashboard/products/categories" className="rounded-md border px-3 py-2 dark:border-slate-700">Catégories</Link></div> : null}
      </div>
      {message ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message} <button type="button" onClick={() => void loadProducts()} className="ml-2 font-bold underline">Réessayer</button></div> : null}

      <div className="grid gap-3 md:hidden">
        {items.map((product) => <article key={product.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <ProductThumb product={product} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-slate-950 dark:text-white">{product.name}</h2>
              <p className="text-sm text-slate-500">{product.category?.name ?? "Sans catégorie"}</p>
            </div>
            <p className="shrink-0 text-right text-sm font-bold text-slate-950 dark:text-white">{formatMoney(product.salePrice)}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <InfoBox label="Quantité"><QuantityDisplay product={product} /></InfoBox>
            <InfoBox label="Catégorie"><p className="truncate font-semibold">{product.category?.name ?? "--"}</p></InfoBox>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link className="block rounded-md bg-brand-600 px-3 py-3 text-center text-sm font-bold text-white" href={`/dashboard/products/${product.id}/edit`}>Modifier</Link>
            <button type="button" onClick={() => void deleteProduct(product)} className="rounded-md border border-red-200 px-3 py-3 text-sm font-bold text-red-600 dark:border-red-900">Supprimer</button>
          </div>
        </article>)}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
            <tr><th className="p-3">Produit</th><th className="p-3">Catégorie</th><th className="p-3">Prix</th><th className="p-3">Quantité</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>{items.map((product) => <tr key={product.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="p-3"><div className="flex items-center gap-3"><ProductThumb product={product} /><p className="font-semibold">{product.name}</p></div></td>
            <td className="p-3">{product.category?.name ?? "--"}</td>
            <td className="p-3 font-semibold">{formatMoney(product.salePrice)}</td>
            <td className="p-3"><QuantityDisplay product={product} /></td>
            <td className="p-3"><div className="flex flex-wrap gap-3"><Link className="font-semibold text-brand-600" href={`/dashboard/products/${product.id}/edit`}>Modifier</Link><button type="button" onClick={() => void deleteProduct(product)} className="font-semibold text-red-600">Supprimer</button></div></td>
          </tr>)}</tbody>
        </table>
        {!isLoading && !message && items.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucun produit trouvé.</p> : null}
        {isLoading ? <p className="p-5 text-sm text-slate-500">Chargement des produits...</p> : null}
      </div>

      <Pagination page={page} pages={pages} total={displayTotal} displayed={items.length} label="produits" onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />

      {isModalOpen ? (
        <Modal title="Nouveau produit" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={createProduct} className="space-y-3">
            <Input required value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Nom du produit *" />
            <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Catégorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <Input type="number" value={form.purchasePrice} onChange={(value) => setForm((current) => ({ ...current, purchasePrice: value }))} placeholder="Prix d'achat / coût - facultatif" />
            <Input required type="number" value={form.salePrice} onChange={(value) => setForm((current) => ({ ...current, salePrice: value }))} placeholder="Prix de vente *" />
            <Input type="number" value={form.stockInitial} onChange={(value) => setForm((current) => ({ ...current, stockInitial: value }))} placeholder="Quantité initiale" />
            <Input type="number" value={form.minimumStock} onChange={(value) => setForm((current) => ({ ...current, minimumStock: value }))} placeholder="Quantité minimale pour stock faible" helper="Alerte quand le stock arrive à ce niveau." />
            <ImagePicker selected={Boolean(form.imageUrl)} onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))} />
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description courte facultative" rows={3} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Produit actif</label>
            {message ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
            <button disabled={isSaving} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "Enregistrement..." : "Enregistrer"}</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button type="button" onClick={onClose} className="rounded-md border px-3 py-1 text-sm dark:border-slate-700">Fermer</button></div>{children}</div></div>;
}

function Input({ value, onChange, placeholder, helper, required = false, type = "text" }: { value: string; placeholder: string; helper?: string; required?: boolean; type?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1"><input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />{helper ? <span className="text-xs text-slate-500">{helper}</span> : null}</label>;
}

function ImagePicker({ selected, onChange }: { selected: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
    Image produit
    <input type="file" accept="image/*" onChange={(event) => void loadImage(event.target.files?.[0], onChange)} className="sr-only" />
    {selected ? <span className="text-xs font-normal text-green-600">Image sélectionnée</span> : <span className="text-xs font-normal text-slate-400">Choisir une image</span>}
  </label>;
}

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">{label}</span>{children}</div>;
}

function ProductThumb({ product }: { product: Product }) {
  const image = resolveAssetUrl(product.images?.[0]?.url);
  return <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-sm font-bold text-slate-500 dark:bg-slate-800">
    {image ? <img src={image} alt={product.images?.[0]?.alt ?? product.name} className="h-full w-full object-cover" /> : productInitials(product.name)}
  </div>;
}

function QuantityDisplay({ product }: { product: Product }) {
  const quantity = Number(product.stockCurrent ?? 0);
  const minimum = Number(product.minimumStock ?? 0);
  const tracked = quantity > 0 || minimum > 0;
  return <div className="flex flex-wrap items-center gap-2">
    <span className="font-semibold">{tracked ? quantity : "—"}</span>
    {tracked && quantity <= 0 ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">Rupture</span> : null}
    {tracked && quantity > 0 && quantity <= minimum ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Stock faible</span> : null}
  </div>;
}

function Pagination({ page, pages, total, displayed, label, onPrev, onNext }: { page: number; pages: number; total: number; displayed: number; label: string; onPrev: () => void; onNext: () => void }) {
  const summary = total > displayed ? `${displayed} / ${total} ${label}` : `Produits affichés : ${displayed || total}`;
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">{summary}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={onPrev} className="rounded-md border px-3 py-2 disabled:opacity-50">Précédent</button><span className="px-3 py-2 text-sm">{page}/{pages}</span><button disabled={page >= pages} onClick={onNext} className="rounded-md border px-3 py-2 disabled:opacity-50">Suivant</button></div></div>;
}

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function productInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
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

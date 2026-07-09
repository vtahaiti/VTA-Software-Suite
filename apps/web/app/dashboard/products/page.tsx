"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Product = { id: string; sku: string; name: string; salePrice: string; stockCurrent?: number; category?: { name: string }; minimumStock: number };
type Category = { id: string; name: string };
const emptyForm = { name: "", salePrice: "", categoryId: "", stockInitial: "", imageUrl: "" };

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { void loadCategories(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => void loadProducts(), 250);
    return () => clearTimeout(timer);
  }, [search, page]);

  async function loadCategories() {
    const response = await fetch(`${apiUrl}/products/categories`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) setCategories(await response.json());
  }

  async function loadProducts() {
    const params = new URLSearchParams({ page: String(page), limit: "10", sortBy: "createdAt", sortOrder: "desc" });
    if (search) params.set("search", search);
    const response = await fetch(`${apiUrl}/products?${params}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) {
      const data = await response.json();
      setItems(data.items ?? []);
      setTotal(data.meta?.total ?? 0);
    }
  }

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);
    const stockInitial = Number(form.stockInitial || 0);
    const response = await fetch(`${apiUrl}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({
        name: form.name,
        salePrice: Number(form.salePrice || 0),
        purchasePrice: 0,
        categoryId: form.categoryId || undefined,
        minimumStock: stockInitial,
        stockInitial,
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

  const pages = useMemo(() => Math.max(1, Math.ceil(total / 10)), [total]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Produits</h1>
        <button onClick={() => setIsModalOpen(true)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">+ Nouveau produit</button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher un produit" className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <button onClick={() => setShowOptions((value) => !value)} className="mt-3 text-sm font-semibold text-slate-500 hover:text-brand-600">Plus d&apos;options</button>
        {showOptions ? <div className="mt-3 flex flex-wrap gap-2 text-sm"><Link href="/dashboard/import-export" className="rounded-md border px-3 py-2 dark:border-slate-700">Import / Export</Link><Link href="/dashboard/products/create" className="rounded-md border px-3 py-2 dark:border-slate-700">Fiche produit avancee</Link><Link href="/dashboard/products/categories" className="rounded-md border px-3 py-2 dark:border-slate-700">Categories</Link></div> : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">📦 Produit</th><th className="p-3">🏷 Categorie</th><th className="p-3">💲 Prix</th><th className="p-3">📦 Stock</th><th className="p-3">⚙️ Actions</th></tr></thead>
          <tbody>{items.map((product) => <tr key={product.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3"><p className="font-semibold">{product.name}</p><p className="font-mono text-xs text-slate-400">{product.sku}</p></td><td className="p-3">{product.category?.name ?? "--"}</td><td className="p-3">{product.salePrice}</td><td className="p-3">{product.stockCurrent ?? 0}</td><td className="p-3"><Link className="text-brand-600" href={`/dashboard/products/${product.id}/edit`}>Modifier</Link></td></tr>)}</tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} total={total} label="produits" onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />

      {isModalOpen ? (
        <Modal title="Nouveau produit" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={createProduct} className="space-y-3">
            <Input required value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Nom *" />
            <Input required type="number" value={form.salePrice} onChange={(value) => setForm((current) => ({ ...current, salePrice: value }))} placeholder="Prix *" />
            <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Categorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <Input type="number" value={form.stockInitial} onChange={(value) => setForm((current) => ({ ...current, stockInitial: value }))} placeholder="Stock initial" />
            <label className="grid gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              📷 Choisir une image
              <input type="file" accept="image/*" onChange={(event) => void loadImage(event.target.files?.[0], (value) => setForm((current) => ({ ...current, imageUrl: value })))} className="sr-only" />
              {form.imageUrl ? <span className="text-xs font-normal text-green-600">Image selectionnee</span> : <span className="text-xs font-normal text-slate-400">Facultatif</span>}
            </label>
            <p className="text-xs text-slate-500">Le stock initial cree la quantite de depart du produit. Les autres entrees restent dans le module Stock.</p>
            {message ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
            <button disabled={isSaving} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "Enregistrement..." : "Enregistrer"}</button>
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
  return <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{total} {label}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={onPrev} className="rounded-md border px-3 py-2 disabled:opacity-50">Precedent</button><span className="px-3 py-2 text-sm">{page}/{pages}</span><button disabled={page >= pages} onClick={onNext} className="rounded-md border px-3 py-2 disabled:opacity-50">Suivant</button></div></div>;
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

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Supplier = { id: string; name: string; phone?: string | null };
type Product = { id: string; name: string; sku: string; purchasePrice?: string | number };
type Line = { productId: string; quantity: number; unitCost: number; tax: number };
type SupplierForm = { name: string; phone: string; address: string; email: string };
type ProductForm = { name: string; salePrice: string; purchasePrice: string; stockInitial: string };

const emptySupplier: SupplierForm = { name: "", phone: "", address: "", email: "" };
const emptyProduct: ProductForm = { name: "", salePrice: "", purchasePrice: "", stockInitial: "" };

export default function CreatePurchasePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Line[]>([{ productId: "", quantity: 1, unitCost: 0, tax: 0 }]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);

  useEffect(() => { void loadReferences(); }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unitCost + item.tax, 0), [items]);

  async function loadReferences() {
    const headers = { Authorization: `Bearer ${getAccessToken()}` };
    const [suppliersResponse, productsResponse] = await Promise.all([
      fetch(`${apiUrl}/suppliers?limit=100`, { headers }),
      fetch(`${apiUrl}/products?limit=100`, { headers })
    ]);
    if (suppliersResponse.ok) {
      const data = await suppliersResponse.json();
      setSuppliers(data.items ?? []);
    }
    if (productsResponse.ok) {
      const data = await productsResponse.json();
      setProducts(data.items ?? []);
    }
  }

  function updateLine(index: number, values: Partial<Line>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const cleanItems = items.filter((item) => item.productId && item.quantity > 0);
    const response = await fetch(`${apiUrl}/purchase-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ supplierId, expectedDate: expectedDate || undefined, notes, items: cleanItems })
    });
    if (response.ok) {
      const order = await response.json();
      router.push(`/dashboard/purchases/${order.id}`);
      return;
    }
    const body = await response.json().catch(() => null);
    setError(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Création impossible");
  }

  async function createSupplier() {
    setError("");
    setMessage("");
    if (!supplierForm.name.trim() || !supplierForm.phone.trim()) {
      setError("Nom et téléphone fournisseur sont obligatoires.");
      return;
    }
    const response = await fetch(`${apiUrl}/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({
        name: supplierForm.name.trim(),
        phone: supplierForm.phone.trim(),
        address: supplierForm.address.trim() || undefined,
        email: supplierForm.email.trim() || undefined
      })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Création fournisseur impossible.");
      return;
    }
    const supplier = await response.json() as Supplier;
    setSuppliers((current) => [supplier, ...current.filter((item) => item.id !== supplier.id)]);
    setSupplierId(supplier.id);
    setSupplierForm(emptySupplier);
    setShowSupplierModal(false);
    setMessage("Fournisseur créé et sélectionné.");
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({
        name: productForm.name.trim(),
        salePrice: Number(productForm.salePrice || productForm.purchasePrice || 0),
        purchasePrice: Number(productForm.purchasePrice || 0),
        stockInitial: Number(productForm.stockInitial || 0)
      })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Création produit impossible.");
      return;
    }
    const product = await response.json() as Product;
    setProducts((current) => [product, ...current.filter((item) => item.id !== product.id)]);
    setItems((current) => {
      const emptyIndex = current.findIndex((item) => !item.productId);
      const nextLine = { productId: product.id, quantity: 1, unitCost: Number(product.purchasePrice ?? productForm.purchasePrice ?? 0), tax: 0 };
      if (emptyIndex === -1) return [...current, nextLine];
      return current.map((item, index) => index === emptyIndex ? nextLine : item);
    });
    setProductForm(emptyProduct);
    setShowProductModal(false);
    setMessage("Produit créé et ajouté au bon.");
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Achats</p>
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Nouveau bon de commande</h1>
      {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_160px_1fr]">
        <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <option value="">Fournisseur</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
        <button type="button" onClick={() => setShowSupplierModal(true)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">+ Nouveau fournisseur</button>
        <input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </div>
    </div>

    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Lignes du bon</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => setItems([...items, { productId: "", quantity: 1, unitCost: 0, tax: 0 }])} className="rounded-md border px-3 py-2 text-sm">Ajouter une ligne</button>
          <button type="button" onClick={() => setShowProductModal(true)} className="rounded-md border px-3 py-2 text-sm font-semibold">+ Nouveau produit</button>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => <div key={index} className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[1fr_120px_140px_120px_80px]">
          <select required value={item.productId} onChange={(event) => {
            const product = products.find((entry) => entry.id === event.target.value);
            updateLine(index, { productId: event.target.value, unitCost: Number(product?.purchasePrice ?? item.unitCost ?? 0) });
          }} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Produit</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}
          </select>
          <input type="number" min="1" value={item.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => updateLine(index, { unitCost: Number(event.target.value) })} placeholder="Coût" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input type="number" min="0" step="0.01" value={item.tax} onChange={(event) => updateLine(index, { tax: Number(event.target.value) })} placeholder="Taxe" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <button type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md text-red-600 disabled:opacity-40" disabled={items.length === 1}>Retirer</button>
        </div>)}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-4">
        <p className="text-lg font-bold">Total: {formatMoney(total)}</p>
        <button className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white">Créer le bon</button>
      </div>
    </div>

    {showSupplierModal ? <QuickModal title="Nouveau fournisseur" onClose={() => setShowSupplierModal(false)} onSubmit={createSupplier} submitLabel="Créer et sélectionner">
      <Input label="Nom *" value={supplierForm.name} onChange={(value) => setSupplierForm((current) => ({ ...current, name: value }))} />
      <Input label="Téléphone *" value={supplierForm.phone} onChange={(value) => setSupplierForm((current) => ({ ...current, phone: value }))} />
      <Input label="Adresse" value={supplierForm.address} onChange={(value) => setSupplierForm((current) => ({ ...current, address: value }))} />
      <Input label="Email" value={supplierForm.email} onChange={(value) => setSupplierForm((current) => ({ ...current, email: value }))} />
    </QuickModal> : null}

    {showProductModal ? <QuickModal title="Nouveau produit" onClose={() => setShowProductModal(false)} onSubmit={createProduct} submitLabel="Créer et ajouter">
      <Input label="Nom *" value={productForm.name} onChange={(value) => setProductForm((current) => ({ ...current, name: value }))} />
      <Input label="Prix d'achat" value={productForm.purchasePrice} onChange={(value) => setProductForm((current) => ({ ...current, purchasePrice: value }))} type="number" />
      <Input label="Prix de vente" value={productForm.salePrice} onChange={(value) => setProductForm((current) => ({ ...current, salePrice: value }))} type="number" />
      <Input label="Stock initial" value={productForm.stockInitial} onChange={(value) => setProductForm((current) => ({ ...current, stockInitial: value }))} type="number" />
    </QuickModal> : null}
  </form>;
}

function QuickModal({ title, children, onClose, onSubmit, submitLabel }: { title: string; children: React.ReactNode; onClose: () => void; onSubmit: () => void; submitLabel: string }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
      </div>
      <div className="mt-4 grid gap-3">
        {children}
        <button type="button" onClick={() => void onSubmit()} className="rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">{submitLabel}</button>
      </div>
    </div>
  </div>;
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-semibold">{label}
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
  </label>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(value || 0);
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Opération impossible";
  } catch {
    return "Opération impossible";
  }
}

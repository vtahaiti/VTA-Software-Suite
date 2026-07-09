"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type SupplierFormState = {
  code: string;
  name: string;
  company: string;
  logoUrl: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  country: string;
  taxNumber: string;
  primaryContact: string;
  paymentTerms: string;
  currency: string;
  status: string;
  balance: string;
  notes: string;
};

const emptyForm: SupplierFormState = {
  code: "",
  name: "",
  company: "",
  logoUrl: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  country: "Haiti",
  taxNumber: "",
  primaryContact: "",
  paymentTerms: "Comptant",
  currency: "HTG",
  status: "ACTIVE",
  balance: "0",
  notes: ""
};

export function SupplierForm({ supplierId }: { supplierId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<SupplierFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { if (supplierId) loadSupplier(); }, [supplierId]);

  async function loadSupplier() {
    const response = await fetch(`${apiUrl}/suppliers/${supplierId}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!response.ok) return;
    const supplier = await response.json();
    setForm({
      code: supplier.code ?? "",
      name: supplier.name ?? "",
      company: supplier.company ?? "",
      logoUrl: supplier.logoUrl ?? "",
      phone: supplier.phone ?? "",
      whatsapp: supplier.whatsapp ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      city: supplier.city ?? "",
      country: supplier.country ?? "Haiti",
      taxNumber: supplier.taxNumber ?? "",
      primaryContact: supplier.primaryContact ?? "",
      paymentTerms: supplier.paymentTerms ?? "Comptant",
      currency: supplier.currency ?? "HTG",
      status: supplier.status ?? "ACTIVE",
      balance: String(supplier.balance ?? 0),
      notes: supplier.notes ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, code: form.code || undefined, logoUrl: form.logoUrl || undefined, taxNumber: form.taxNumber || undefined, balance: Number(form.balance || 0) };
    const response = await fetch(supplierId ? `${apiUrl}/suppliers/${supplierId}` : `${apiUrl}/suppliers`, {
      method: supplierId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify(payload)
    });
    setMessage(response.ok ? "Fournisseur enregistre." : "Impossible d'enregistrer le fournisseur.");
    if (response.ok) router.push("/dashboard/suppliers");
  }

  function update(key: keyof SupplierFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Fournisseurs</p>
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Fiche fournisseur</h1>
      <p className="mt-1 text-sm text-slate-500">Informations professionnelles, conditions de paiement et statut.</p>
      {message ? <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">{message}</p> : null}
    </div>
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
      <input required value={form.name} onChange={(e)=>update("name",e.target.value)} placeholder="Nom du fournisseur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.company} onChange={(e)=>update("company",e.target.value)} placeholder="Societe" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.code} onChange={(e)=>update("code",e.target.value)} placeholder="Code fournisseur automatique si vide" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <label className="grid gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
        📷 Ajouter un logo
        <input type="file" accept="image/*" onChange={(event) => void loadImage(event.target.files?.[0], (value) => update("logoUrl", value))} className="sr-only" />
        {form.logoUrl ? <span className="text-xs font-normal text-green-600">Logo selectionne</span> : <span className="text-xs font-normal text-slate-400">Facultatif</span>}
      </label>
      <input value={form.phone} onChange={(e)=>update("phone",e.target.value)} placeholder="Telephone" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.whatsapp} onChange={(e)=>update("whatsapp",e.target.value)} placeholder="WhatsApp" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.email} onChange={(e)=>update("email",e.target.value)} placeholder="Email" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.primaryContact} onChange={(e)=>update("primaryContact",e.target.value)} placeholder="Personne de contact" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.address} onChange={(e)=>update("address",e.target.value)} placeholder="Adresse" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.city} onChange={(e)=>update("city",e.target.value)} placeholder="Ville" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.country} onChange={(e)=>update("country",e.target.value)} placeholder="Pays" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <input value={form.taxNumber} onChange={(e)=>update("taxNumber",e.target.value)} placeholder="Numero fiscal (facultatif)" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <select value={form.paymentTerms} onChange={(e)=>update("paymentTerms",e.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option>Comptant</option><option>Credit 15 jours</option><option>Credit 30 jours</option><option>Credit 60 jours</option></select>
      <select value={form.currency} onChange={(e)=>update("currency",e.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option>HTG</option><option>USD</option><option>EUR</option><option>DOP</option><option>CAD</option></select>
      <select value={form.status} onChange={(e)=>update("status",e.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option></select>
      <input value={form.balance} onChange={(e)=>update("balance",e.target.value)} placeholder="Solde fournisseur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      <textarea value={form.notes} onChange={(e)=>update("notes",e.target.value)} placeholder="Notes" className="min-h-28 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2" />
      <div className="flex items-center gap-3 md:col-span-2"><button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button></div>
    </div>
  </form>;
}

function loadImage(file: File | undefined, onDone: (value: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result));
  reader.readAsDataURL(file);
}

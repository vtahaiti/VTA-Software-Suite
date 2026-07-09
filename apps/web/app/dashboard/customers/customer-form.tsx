"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const emptyForm = { customerCode: "", firstName: "", lastName: "", company: "", displayName: "", phone: "", mobile: "", whatsapp: "", email: "", website: "", taxNumber: "", country: "", city: "", address: "", postalCode: "", creditLimit: "0", currentBalance: "0", customerType: "INDIVIDUAL", status: "ACTIVE", notes: "" };

export function CustomerForm({ customerId }: { customerId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { if (customerId) loadCustomer(); }, [customerId]);

  async function loadCustomer() {
    const response = await fetch(`${apiUrl}/customers/${customerId}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) {
      const customer = await response.json();
      setForm({
        customerCode: customer.customerCode ?? "",
        firstName: customer.firstName ?? "",
        lastName: customer.lastName ?? "",
        company: customer.company ?? "",
        displayName: customer.displayName ?? "",
        phone: customer.phone ?? "",
        mobile: customer.mobile ?? "",
        whatsapp: customer.whatsapp ?? "",
        email: customer.email ?? "",
        website: customer.website ?? "",
        taxNumber: customer.taxNumber ?? "",
        country: customer.country ?? "",
        city: customer.city ?? "",
        address: customer.address ?? "",
        postalCode: customer.postalCode ?? "",
        creditLimit: String(customer.creditLimit ?? 0),
        currentBalance: String(customer.currentBalance ?? 0),
        customerType: customer.customerType ?? "INDIVIDUAL",
        status: customer.status ?? "ACTIVE",
        notes: customer.notes ?? ""
      });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setIsLoading(true);
    const payload = Object.fromEntries(Object.entries({ ...form, customerCode: form.customerCode || undefined, displayName: form.displayName || undefined, creditLimit: Number(form.creditLimit || 0), currentBalance: Number(form.currentBalance || 0) }).filter(([, value]) => value !== ""));
    const response = await fetch(customerId ? `${apiUrl}/customers/${customerId}` : `${apiUrl}/customers`, { method: customerId ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify(payload) });
    setIsLoading(false);
    if (response.ok) { const saved = await response.json(); router.push(`/dashboard/customers/${saved.id}`); return; }
    const body = await response.json().catch(() => null);
    setMessage(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Impossible d'enregistrer le client.");
  }

  function update(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }

  return <form onSubmit={submit} className="space-y-5"><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Informations</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><input value={form.displayName} onChange={(e)=>update("displayName",e.target.value)} placeholder="Nom affiche" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.customerCode} onChange={(e)=>update("customerCode",e.target.value)} placeholder="Code client automatique si vide" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.firstName} onChange={(e)=>update("firstName",e.target.value)} placeholder="Prenom" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.lastName} onChange={(e)=>update("lastName",e.target.value)} placeholder="Nom" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.company} onChange={(e)=>update("company",e.target.value)} placeholder="Entreprise" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.taxNumber} onChange={(e)=>update("taxNumber",e.target.value)} placeholder="Numero fiscal" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><select value={form.customerType} onChange={(e)=>update("customerType",e.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="INDIVIDUAL">Particulier</option><option value="BUSINESS">Entreprise</option><option value="VIP">VIP</option><option value="WHOLESALE">Grossiste</option><option value="GOVERNMENT">Gouvernement</option></select><select value={form.status} onChange={(e)=>update("status",e.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option><option value="BLOCKED">Bloque</option></select></div></section><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Contact et adresse</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><input value={form.phone} onChange={(e)=>update("phone",e.target.value)} placeholder="Telephone" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.mobile} onChange={(e)=>update("mobile",e.target.value)} placeholder="Mobile" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.whatsapp} onChange={(e)=>update("whatsapp",e.target.value)} placeholder="WhatsApp" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.email} onChange={(e)=>update("email",e.target.value)} placeholder="Email" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.website} onChange={(e)=>update("website",e.target.value)} placeholder="Site web" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.country} onChange={(e)=>update("country",e.target.value)} placeholder="Pays" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.city} onChange={(e)=>update("city",e.target.value)} placeholder="Ville" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.postalCode} onChange={(e)=>update("postalCode",e.target.value)} placeholder="Code postal" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><textarea value={form.address} onChange={(e)=>update("address",e.target.value)} placeholder="Adresse" className="min-h-24 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2"/></div></section><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Comptabilite et notes</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><input value={form.creditLimit} onChange={(e)=>update("creditLimit",e.target.value)} placeholder="Limite de credit" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input value={form.currentBalance} onChange={(e)=>update("currentBalance",e.target.value)} placeholder="Solde courant" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><textarea value={form.notes} onChange={(e)=>update("notes",e.target.value)} placeholder="Notes" className="min-h-28 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2"/></div>{message ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}<button disabled={isLoading} className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isLoading ? "Enregistrement..." : "Enregistrer"}</button></section></form>;
}
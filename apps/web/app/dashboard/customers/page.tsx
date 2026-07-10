"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { formatMoney, pluralize } from "@/lib/format";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Customer = {
  id: string;
  customerCode: string;
  displayName: string;
  company?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  address?: string;
  currentBalance: string;
};

const emptyForm = { name: "", phone: "", address: "", email: "", company: "", notes: "" };

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => void loadCustomers(), 250);
    return () => clearTimeout(timer);
  }, [search, page]);

  async function loadCustomers() {
    const params = new URLSearchParams({ page: String(page), limit: "10", sortBy: "createdAt", sortOrder: "desc" });
    if (search) params.set("search", search);
    const response = await fetch(`${apiUrl}/customers?${params}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) {
      const data = await response.json();
      setItems(data.items ?? []);
      setTotal(data.meta?.total ?? 0);
    }
  }

  async function createCustomer(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);
    const response = await fetch(`${apiUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({
        displayName: form.name,
        phone: form.phone,
        mobile: form.phone,
        address: form.address || undefined,
        email: form.email || undefined,
        company: form.company || undefined,
        notes: form.notes || undefined,
        customerType: form.company ? "BUSINESS" : "INDIVIDUAL",
        status: "ACTIVE",
        currentBalance: 0,
        creditLimit: 0
      })
    });
    setIsSaving(false);
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    setForm(emptyForm);
    setIsModalOpen(false);
    await loadCustomers();
  }

  const pages = useMemo(() => Math.max(1, Math.ceil(total / 10)), [total]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Clients</h1>
        <button onClick={() => setIsModalOpen(true)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">+ Nouveau client</button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher un client" className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <button onClick={() => setShowOptions((value) => !value)} className="mt-3 text-sm font-semibold text-slate-500 hover:text-brand-600">Plus d&apos;options</button>
        {showOptions ? <div className="mt-3 flex flex-wrap gap-2 text-sm"><Link href="/dashboard/import-export" className="rounded-md border px-3 py-2 dark:border-slate-700">Import / Export</Link><Link href="/dashboard/customers/create" className="rounded-md border px-3 py-2 dark:border-slate-700">Fiche client avanc?e</Link></div> : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">ðŸ‘¤ Nom</th><th className="p-3">ðŸ“ž Téléphone</th><th className="p-3">ðŸ¢ Entreprise</th><th className="p-3">ðŸ’° Solde</th><th className="p-3">âš™ï¸ Actions</th></tr></thead>
          <tbody>{items.map((customer) => <tr key={customer.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3"><Link href={`/dashboard/customers/${customer.id}`} className="font-semibold text-brand-700 dark:text-brand-300">{customer.displayName}</Link><p className="font-mono text-xs text-slate-400">{customer.customerCode}</p></td><td className="p-3">{customer.mobile ?? customer.phone ?? "--"}</td><td className="p-3">{customer.company ?? "--"}</td><td className="p-3">{formatMoney(customer.currentBalance)}</td><td className="p-3"><Link className="text-brand-600" href={`/dashboard/customers/${customer.id}/edit`}>Modifier</Link></td></tr>)}</tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} total={total} label="clients" onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />

      {isModalOpen ? (
        <Modal title="Nouveau client" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={createCustomer} className="space-y-3">
            <Input required value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Nom *" />
            <Input required value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} placeholder="T?l?phone *" />
            <Input value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} placeholder="Adresse" />
            <Input value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} placeholder="Email" />
            <Input value={form.company} onChange={(value) => setForm((current) => ({ ...current, company: value }))} placeholder="Entreprise" />
            <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" className="min-h-24 w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
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

function Input({ value, onChange, placeholder, required = false }: { value: string; placeholder: string; required?: boolean; onChange: (value: string) => void }) {
  return <input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />;
}

function Pagination({ page, pages, total, label, onPrev, onNext }: { page: number; pages: number; total: number; label: string; onPrev: () => void; onNext: () => void }) {
  return <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{pluralize(total, label)}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={onPrev} className="rounded-md border px-3 py-2 disabled:opacity-50">Précédent</button><span className="px-3 py-2 text-sm">{page}/{pages}</span><button disabled={page >= pages} onClick={onNext} className="rounded-md border px-3 py-2 disabled:opacity-50">Suivant</button></div></div>;
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Enregistrement impossible.";
}



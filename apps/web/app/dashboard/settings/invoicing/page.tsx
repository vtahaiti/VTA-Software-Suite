"use client";
import { FormEvent, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type InvoicingForm = {
  defaultTaxRate: number | string;
  maxDiscountRate: number | string;
  invoicePrefix: string;
  quotePrefix: string;
  receiptPrefix: string;
  posReceiptFormat: "58" | "80";
  invoiceFormat: "A4" | "LETTER";
};

const initialForm: InvoicingForm = {
  defaultTaxRate: 10,
  maxDiscountRate: 0,
  invoicePrefix: "INV",
  quotePrefix: "QUO",
  receiptPrefix: "RCT",
  posReceiptFormat: "80",
  invoiceFormat: "LETTER"
};

export default function InvoicingSettingsPage() {
  const [form, setForm] = useState<InvoicingForm>(initialForm);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${apiUrl}/settings/invoicing`, { headers: { Authorization: `Bearer ${getAccessToken()}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setForm({ ...data, defaultTaxRate: Number(data.defaultTaxRate), maxDiscountRate: Number(data.maxDiscountRate) }));
  }, []);

  function update(key: keyof InvoicingForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const defaultTaxRate = Number(form.defaultTaxRate);
    const maxDiscountRate = Number(form.maxDiscountRate);
    if (defaultTaxRate < 0 || defaultTaxRate > 100 || maxDiscountRate < 0 || maxDiscountRate > 100) {
      setMsg("La taxe et la remise doivent être comprises entre 0 % et 100 %.");
      return;
    }
    const payload = { ...form, defaultTaxRate, maxDiscountRate };
    const response = await fetch(`${apiUrl}/settings/invoicing`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify(payload) });
    setMsg(response.ok ? "Paramètres de facturation sauvegardés." : "Sauvegarde impossible.");
    if (response.ok) {
      const data = await response.json();
      setForm({ ...data, defaultTaxRate: Number(data.defaultTaxRate), maxDiscountRate: Number(data.maxDiscountRate) });
    }
  }

  return <div className="space-y-5"><Header/><form onSubmit={submit} className="grid gap-4 rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2"><Input type="number" min="0" max="100" step="0.01" label="Taxe par défaut (%)" help="Contrat : l'interface et l'API utilisent 10 pour 10 %. La base conserve 0,10 pour les calculs." value={form.defaultTaxRate} onChange={(value)=>update("defaultTaxRate",value)}/><Input type="number" min="0" max="100" step="0.01" label="Remise maximale autorisée (%)" value={form.maxDiscountRate} onChange={(value)=>update("maxDiscountRate",value)}/><Input label="Numérotation factures" value={form.invoicePrefix} onChange={(value)=>update("invoicePrefix",value)}/><Input label="Numérotation devis" value={form.quotePrefix} onChange={(value)=>update("quotePrefix",value)}/><Input label="Numérotation reçus" value={form.receiptPrefix} onChange={(value)=>update("receiptPrefix",value)}/><label className="grid gap-1 text-sm font-medium">Format ticket POS<select value={form.posReceiptFormat} onChange={(event)=>update("posReceiptFormat",event.target.value)} className="rounded-md border px-3 py-2 dark:bg-slate-950"><option value="58">58 mm</option><option value="80">80 mm</option></select></label><label className="grid gap-1 text-sm font-medium">Format facture<select value={form.invoiceFormat} onChange={(event)=>update("invoiceFormat",event.target.value)} className="rounded-md border px-3 py-2 dark:bg-slate-950"><option value="A4">A4</option><option value="LETTER">Letter 8.5 x 11</option></select></label><div className="md:col-span-2 flex items-center gap-3"><button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Sauvegarder</button>{msg ? <p className="text-sm text-slate-500">{msg}</p> : null}</div></form></div>;
}

function Header() {
  return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Paramètres</p><h1 className="text-2xl font-bold">Paramètres de facturation</h1><div className="mt-4 flex flex-wrap gap-2"><a href="/dashboard/settings/company" className="rounded-md border px-3 py-2 text-sm">Entreprise</a><a href="/dashboard/settings/pos" className="rounded-md border px-3 py-2 text-sm">POS</a><a href="/dashboard/settings/invoicing" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">Facturation</a></div></div>;
}

function Input({ label, value, onChange, help, type = "text", min, max, step }: { label: string; value: string | number; help?: string; type?: string; min?: string; max?: string; step?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<input type={type} min={min} max={max} step={step} value={value ?? ""} onChange={(event)=>onChange(event.target.value)} className="rounded-md border px-3 py-2 dark:bg-slate-950"/>{help ? <span className="text-xs font-normal text-slate-500">{help}</span> : null}</label>;
}

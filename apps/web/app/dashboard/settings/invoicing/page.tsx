"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type InvoicingForm = {
  taxEnabled: boolean;
  defaultTaxRate: number | string;
  maxDiscountRate: number | string;
  invoicePrefix: string;
  quotePrefix: string;
  receiptPrefix: string;
  posReceiptFormat: "58" | "80";
  invoiceFormat: "A4" | "LETTER";
};

const initialForm: InvoicingForm = {
  taxEnabled: false,
  defaultTaxRate: 0,
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/settings/invoicing`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setForm(toInvoicingForm(data)));
  }, []);

  function update(key: keyof InvoicingForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateBoolean(key: keyof InvoicingForm, value: boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setMsg("");
    const defaultTaxRate = Number(form.defaultTaxRate);
    const maxDiscountRate = Number(form.maxDiscountRate);
    if (defaultTaxRate < 0 || defaultTaxRate > 100 || maxDiscountRate < 0 || maxDiscountRate > 100) {
      setMsg("La taxe et la remise doivent être comprises entre 0 % et 100 %.");
      return;
    }
    setSaving(true);
    try {
      const payload = toInvoicingPayload(form, defaultTaxRate, maxDiscountRate);
      const response = await fetchWithAuth(`${apiUrl}/settings/invoicing`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) {
        setMsg("Sauvegarde impossible. Vérifiez les champs puis réessayez.");
        return;
      }
      setForm(toInvoicingForm(await response.json()));
      setMsg("Paramètres enregistrés.");
    } catch {
      setMsg("Sauvegarde impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-5"><Header/><form onSubmit={submit} className="grid gap-4 rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2"><label className="flex items-start gap-3 rounded-md border p-3 text-sm font-medium dark:border-slate-800"><input type="checkbox" checked={form.taxEnabled} onChange={(event)=>updateBoolean("taxEnabled", event.target.checked)} className="mt-1" /><span><span className="block font-semibold">Activer la taxe</span><span className="block text-xs font-normal text-slate-500">Si cette option est désactivée, le POS applique toujours 0 % même si un taux est renseigné.</span></span></label><Input type="number" min="0" max="100" step="0.01" label="Taxe par défaut (%)" help="Contrat : l'interface et l'API utilisent 10 pour 10 %. La base conserve 0,10 pour les calculs. La taxe ne s'applique que si elle est activée." value={form.defaultTaxRate} onChange={(value)=>update("defaultTaxRate",value)}/><Input type="number" min="0" max="100" step="0.01" label="Remise maximale autorisée (%)" value={form.maxDiscountRate} onChange={(value)=>update("maxDiscountRate",value)}/><Input label="Numérotation factures" value={form.invoicePrefix} onChange={(value)=>update("invoicePrefix",value)}/><Input label="Numérotation devis" value={form.quotePrefix} onChange={(value)=>update("quotePrefix",value)}/><Input label="Numérotation reçus" value={form.receiptPrefix} onChange={(value)=>update("receiptPrefix",value)}/><label className="grid gap-1 text-sm font-medium">Format ticket POS<select value={form.posReceiptFormat} onChange={(event)=>update("posReceiptFormat",event.target.value)} className="rounded-md border px-3 py-2 dark:bg-slate-950"><option value="58">58 mm</option><option value="80">80 mm</option></select></label><label className="grid gap-1 text-sm font-medium">Format facture<select value={form.invoiceFormat} onChange={(event)=>update("invoiceFormat",event.target.value)} className="rounded-md border px-3 py-2 dark:bg-slate-950"><option value="A4">A4</option><option value="LETTER">Letter 8.5 x 11</option></select></label><div className="md:col-span-2 flex items-center gap-3"><button disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Enregistrement..." : "Sauvegarder"}</button>{msg ? <p className="text-sm text-slate-500">{msg}</p> : null}</div></form></div>;
}

function toInvoicingForm(data: Partial<InvoicingForm>): InvoicingForm {
  return {
    taxEnabled: Boolean((data as InvoicingForm).taxEnabled ?? initialForm.taxEnabled),
    defaultTaxRate: Number(data.defaultTaxRate ?? initialForm.defaultTaxRate),
    maxDiscountRate: Number(data.maxDiscountRate ?? initialForm.maxDiscountRate),
    invoicePrefix: String(data.invoicePrefix ?? initialForm.invoicePrefix),
    quotePrefix: String(data.quotePrefix ?? initialForm.quotePrefix),
    receiptPrefix: String(data.receiptPrefix ?? initialForm.receiptPrefix),
    posReceiptFormat: data.posReceiptFormat === "58" ? "58" : "80",
    invoiceFormat: data.invoiceFormat === "A4" ? "A4" : "LETTER"
  };
}

function toInvoicingPayload(form: InvoicingForm, defaultTaxRate: number, maxDiscountRate: number) {
  return {
    taxEnabled: form.taxEnabled,
    defaultTaxRate,
    maxDiscountRate,
    invoicePrefix: String(form.invoicePrefix ?? ""),
    quotePrefix: String(form.quotePrefix ?? ""),
    receiptPrefix: String(form.receiptPrefix ?? ""),
    posReceiptFormat: form.posReceiptFormat,
    invoiceFormat: form.invoiceFormat
  };
}

function Header() {
  return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Paramètres</p><h1 className="text-2xl font-bold">Paramètres de facturation</h1><div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/settings/company" className="rounded-md border px-3 py-2 text-sm">Entreprise</Link><Link href="/dashboard/settings/pos" className="rounded-md border px-3 py-2 text-sm">POS</Link><Link href="/dashboard/settings/invoicing" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">Facturation</Link><Link href="/dashboard/settings/subscription" className="rounded-md border px-3 py-2 text-sm">Abonnement</Link><Link href="/dashboard/settings/emails" className="rounded-md border px-3 py-2 text-sm">Emails</Link></div></div>;
}

function Input({ label, value, onChange, help, type = "text", min, max, step }: { label: string; value: string | number; help?: string; type?: string; min?: string; max?: string; step?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<input type={type} min={min} max={max} step={step} value={value ?? ""} onChange={(event)=>onChange(event.target.value)} className="rounded-md border px-3 py-2 dark:bg-slate-950"/>{help ? <span className="text-xs font-normal text-slate-500">{help}</span> : null}</label>;
}



"use client";

import Link from "next/link";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { getReceiptPrintSettings, openThermalDemoPreview } from "@/lib/print";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

type PosForm = {
  allowNegativeStock: boolean;
  allowDiscount: boolean;
  requireCustomer: boolean;
  autoPrintReceipt: boolean;
  openCashDrawer: boolean;
};

type ReceiptPreviewWidth = "58" | "72" | "80";

export default function PosSettingsPage() {
  const [form, setForm] = useState<PosForm>({ allowNegativeStock: false, allowDiscount: true, requireCustomer: false, autoPrintReceipt: false, openCashDrawer: false });
  const [receiptWidth, setReceiptWidth] = useState<ReceiptPreviewWidth>("80");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/settings/pos`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setForm(toPosForm(data)));
    void getReceiptPrintSettings().then((settings) => setReceiptWidth(settings.width)).catch(() => undefined);
  }, []);

  function update(key: keyof PosForm, value: boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setMsg("");
    setSaving(true);
    try {
      const response = await fetchWithAuth(`${apiUrl}/settings/pos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPosForm(form)) });
      if (!response.ok) {
        setMsg("Sauvegarde impossible. Vérifiez les champs puis réessayez.");
        return;
      }
      setForm(toPosForm(await response.json()));
      setMsg("Paramètres enregistrés.");
    } catch {
      setMsg("Sauvegarde impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSaving(false);
    }
  }

  function previewTicket() {
    try {
      openThermalDemoPreview(receiptWidth);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Aperçu du ticket impossible.");
    }
  }

  return <div className="space-y-5"><Header/><form onSubmit={submit} className="space-y-3 rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><Toggle label="Autoriser vente sans stock" checked={form.allowNegativeStock} onChange={(value)=>update("allowNegativeStock",value)}/><Toggle label="Autoriser remise" checked={form.allowDiscount} onChange={(value)=>update("allowDiscount",value)}/><Toggle label="Client obligatoire" checked={form.requireCustomer} onChange={(value)=>update("requireCustomer",value)}/><Toggle label="Imprimer automatiquement après vente" checked={form.autoPrintReceipt} onChange={(value)=>update("autoPrintReceipt",value)}/><Toggle label="Ouvrir tiroir-caisse préparé" checked={form.openCashDrawer} onChange={(value)=>update("openCashDrawer",value)}/><div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700"><p className="text-sm font-semibold">Test imprimante thermique</p><p className="mt-1 text-sm text-slate-500">Format actuel : {receiptWidth} mm. Le bouton ouvre un ticket de test sans créer de vente.</p><button type="button" onClick={previewTicket} className="mt-3 rounded-md border px-4 py-2 text-sm font-semibold">Aperçu du ticket</button></div><div className="flex flex-wrap items-center gap-3 pt-3"><button disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Enregistrement..." : "Sauvegarder"}</button>{msg ? <p className="text-sm text-slate-500">{msg}</p> : null}</div></form></div>;
}

function toPosForm(data: Partial<PosForm>): PosForm {
  return {
    allowNegativeStock: Boolean(data.allowNegativeStock),
    allowDiscount: data.allowDiscount !== false,
    requireCustomer: Boolean(data.requireCustomer),
    autoPrintReceipt: Boolean(data.autoPrintReceipt),
    openCashDrawer: Boolean(data.openCashDrawer)
  };
}

function Header() {
  return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Paramètres</p><h1 className="text-2xl font-bold">Paramètres POS</h1><div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/settings/company" className="rounded-md border px-3 py-2 text-sm">Entreprise</Link><Link href="/dashboard/settings/pos" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">POS</Link><Link href="/dashboard/settings/invoicing" className="rounded-md border px-3 py-2 text-sm">Facturation</Link><Link href="/dashboard/settings/subscription" className="rounded-md border px-3 py-2 text-sm">Abonnement</Link><Link href="/dashboard/settings/emails" className="rounded-md border px-3 py-2 text-sm">Emails</Link></div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 rounded-md border p-3 dark:border-slate-800"><span className="font-medium">{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={(event)=>onChange(event.target.checked)} /></label>;
}



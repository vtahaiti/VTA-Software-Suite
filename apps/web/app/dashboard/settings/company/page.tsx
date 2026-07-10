"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { initials, resolveAssetUrl } from "@/lib/company-branding";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const tabs = [["Entreprise", "/dashboard/settings/company"], ["POS", "/dashboard/settings/pos"], ["Facturation", "/dashboard/settings/invoicing"]];
const colors = [
  ["Bleu", "#2563eb"],
  ["Vert", "#16a34a"],
  ["Orange", "#f97316"],
  ["Rouge", "#dc2626"],
  ["Violet", "#7c3aed"],
  ["Gris", "#475569"]
];

type CompanyForm = { name: string; companyName?: string; logoUrl?: string; primaryColor?: string; phone?: string; whatsapp?: string; email?: string; address?: string; city?: string; country?: string; taxNumber?: string; currency?: string; language?: string; timezone?: string };

export default function CompanySettingsPage() {
  const [form, setForm] = useState<CompanyForm>({ name: "", companyName: "", logoUrl: "", primaryColor: "#2563eb", phone: "", whatsapp: "", email: "", address: "", city: "", country: "", taxNumber: "", currency: "HTG", language: "fr", timezone: "America/Port-au-Prince" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${apiUrl}/settings/company`, { headers: { Authorization: `Bearer ${getAccessToken()}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setForm({ ...data, companyName: data.companyName ?? data.name, primaryColor: data.primaryColor ?? "#2563eb" }))
      .catch(() => undefined);
  }, []);

  function update(key: keyof CompanyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMsg("");
    const response = await fetch(`${apiUrl}/settings/company`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ ...form, name: form.companyName ?? form.name })
    });
    setMsg(response.ok ? "ParamÃ¨tres entreprise sauvegardÃ©s." : "Sauvegarde impossible.");
    if (response.ok) setForm(await response.json());
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("logoUrl", String(reader.result));
    reader.readAsDataURL(file);
  }

  const companyName = form.companyName || form.name || "Mon entreprise";
  const logo = resolveAssetUrl(form.logoUrl);
  const primaryColor = form.primaryColor || "#2563eb";

  return <div className="space-y-5"><Header active="Entreprise" />
    <form onSubmit={submit} className="grid gap-4 rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-col gap-4 rounded-lg border border-dashed p-4 dark:border-slate-700 sm:flex-row sm:items-center">
        {logo ? <img src={logo} alt={`Logo ${companyName}`} className="h-20 w-20 rounded-xl object-cover shadow-sm" /> : <div className="flex h-20 w-20 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm" style={{ backgroundColor: primaryColor }}>{initials(companyName, "ME")}</div>}
        <div className="flex-1">
          <label className="inline-flex cursor-pointer items-center rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
            ðŸ“· Choisir un logo
            <input type="file" accept="image/*" onChange={uploadLogo} className="sr-only" />
          </label>
          <p className="mt-1 text-xs text-slate-500">Si aucun logo n&apos;est configure, les initiales de l&apos;entreprise sont affichees automatiquement.</p>
        </div>
      </div>
      <Input label="Nom entreprise" value={companyName} onChange={(value) => update("companyName", value)} />
      <Input label="Téléphone" value={form.phone} onChange={(value) => update("phone", value)} />
      <Input label="Email" value={form.email} onChange={(value) => update("email", value)} />
      <Input label="Adresse" value={form.address} onChange={(value) => update("address", value)} />
      <Input label="Ville" value={form.city} onChange={(value) => update("city", value)} />
      <Input label="Pays" value={form.country} onChange={(value) => update("country", value)} />
      <Input label="WhatsApp" value={form.whatsapp} onChange={(value) => update("whatsapp", value)} />
      <Input label="Numéro fiscal" value={form.taxNumber} onChange={(value) => update("taxNumber", value)} />
      <div className="md:col-span-2">
        <p className="mb-2 text-sm font-semibold">Couleur principale</p>
        <div className="flex flex-wrap gap-2">
          {colors.map(([label, value]) => <button type="button" key={value} onClick={() => update("primaryColor", value)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${primaryColor === value ? "border-slate-950 dark:border-white" : "border-slate-200 dark:border-slate-700"}`}><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: value }} />{label}</button>)}
        </div>
      </div>
      <div className="md:col-span-2 flex items-center gap-3"><button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Sauvegarder</button>{msg && <p className="text-sm text-slate-500">{msg}</p>}</div>
    </form>
  </div>;
}

function Header({ active }: { active: string }) {
  return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">ParamÃ¨tres</p><h1 className="text-2xl font-bold">Profil de l&apos;entreprise</h1><div className="mt-4 flex flex-wrap gap-2">{tabs.map(([label, href]) => <a key={href} href={href} className={`rounded-md px-3 py-2 text-sm ${label === active ? "bg-brand-600 text-white" : "border"}`}>{label}</a>)}</div></div>;
}

function Input({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<input value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="rounded-md border px-3 py-2 dark:bg-slate-950" /></label>;
}


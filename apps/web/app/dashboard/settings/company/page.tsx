"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { initials, resolveAssetUrl } from "@/lib/company-branding";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));
const tabs = [["Entreprise", "/dashboard/settings/company"], ["Activité", "/dashboard/settings/business-modules"], ["POS", "/dashboard/settings/pos"], ["Facturation", "/dashboard/settings/invoicing"], ["Abonnement", "/dashboard/settings/subscription"], ["Emails", "/dashboard/settings/emails"]];
const colors = [
  ["Bleu", "#2563eb"],
  ["Vert", "#16a34a"],
  ["Orange", "#f97316"],
  ["Rouge", "#dc2626"],
  ["Violet", "#7c3aed"],
  ["Gris", "#475569"]
];
const maxLogoBytes = 2 * 1024 * 1024;
const allowedLogoTypes = ["image/png", "image/jpeg", "image/webp"];

type CompanyForm = { name: string; companyName?: string; logoUrl?: string; primaryColor?: string; phone?: string; whatsapp?: string; email?: string; address?: string; city?: string; country?: string; taxNumber?: string; currency?: string; language?: string; timezone?: string };

export default function CompanySettingsPage() {
  const [form, setForm] = useState<CompanyForm>({ name: "", companyName: "", logoUrl: "", primaryColor: "#2563eb", phone: "", whatsapp: "", email: "", address: "", city: "", country: "", taxNumber: "", currency: "HTG", language: "fr", timezone: "America/Port-au-Prince" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const companyName = form.companyName || form.name || "Mon entreprise";
  const logo = useMemo(() => localLogoPreview ?? resolveAssetUrl(form.logoUrl), [localLogoPreview, form.logoUrl]);
  const primaryColor = form.primaryColor || "#2563eb";

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/settings/company`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setForm(toCompanyForm(data)))
      .catch(() => undefined);
  }, []);

  useEffect(() => () => {
    if (localLogoPreview) URL.revokeObjectURL(localLogoPreview);
  }, [localLogoPreview]);

  useEffect(() => {
    setLogoFailed(false);
  }, [logo]);

  function update(key: keyof CompanyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || uploadingLogo) return;
    setMsg("");
    setSaving(true);
    try {
      const payload = toCompanyPayload(form);
      const response = await fetchWithAuth(`${apiUrl}/settings/company`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setMsg(await readSettingsError(response));
        return;
      }
      const updated = toCompanyForm(await response.json());
      setForm(updated);
      if (localLogoPreview) URL.revokeObjectURL(localLogoPreview);
      setLocalLogoPreview(null);
      window.dispatchEvent(new CustomEvent("vta:branding-updated"));
      setMsg("Paramètres enregistrés.");
    } catch {
      setMsg("Sauvegarde impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMsg("");
    if (!allowedLogoTypes.includes(file.type)) {
      setMsg("Format non accepté. Utilisez PNG, JPG, JPEG ou WebP.");
      return;
    }
    setUploadingLogo(true);
    const previousLogoUrl = form.logoUrl ?? "";
    try {
      const optimized = await optimizeLogoFile(file);
      if (optimized.size > maxLogoBytes) {
        setMsg("Le fichier est trop grand. Taille maximale : 2 Mo.");
        return;
      }
      const previewUrl = URL.createObjectURL(optimized);
      if (localLogoPreview) URL.revokeObjectURL(localLogoPreview);
      setLocalLogoPreview(previewUrl);
      const body = new FormData();
      body.append("file", optimized, optimized.name);
      const response = await fetchWithAuth(`${apiUrl}/uploads/company-logo`, { method: "POST", body });
      if (!response.ok) {
        setLocalLogoPreview(null);
        update("logoUrl", previousLogoUrl);
        setMsg(await readSettingsError(response));
        return;
      }
      const result = await response.json() as { url?: string };
      if (!result.url) throw new Error("Logo non reçu.");
      update("logoUrl", result.url);
      setMsg("Logo chargé. Cliquez sur Sauvegarder pour l’appliquer aux paramètres.");
    } catch {
      update("logoUrl", previousLogoUrl);
      setMsg("Impossible de charger le logo. Vérifiez le fichier puis réessayez.");
    } finally {
      setUploadingLogo(false);
    }
  }

  return <div className="space-y-5"><Header active="Entreprise" />
    <form onSubmit={submit} className="grid gap-4 rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-col gap-4 rounded-lg border border-dashed p-4 dark:border-slate-700 sm:flex-row sm:items-center">
        {logo && !logoFailed ? <img src={logo} alt={`Logo ${companyName}`} onError={() => setLogoFailed(true)} className="h-20 w-20 rounded-xl object-contain shadow-sm" /> : <div className="flex h-20 w-20 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm" style={{ backgroundColor: primaryColor }}>{initials(companyName, "ME")}</div>}
        <div className="flex-1">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
            <Camera className="h-4 w-4" aria-hidden="true" />
            {uploadingLogo ? "Chargement du logo..." : "Choisir un logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={uploadingLogo || saving} className="sr-only" />
          </label>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG, JPEG ou WebP. Le logo est compressé avant l’envoi. Taille maximale : 2 Mo.</p>
          <p className="mt-1 text-xs text-slate-500">Si aucun logo n&apos;est configuré, les initiales de l&apos;entreprise sont affichées automatiquement.</p>
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
      <div className="md:col-span-2 flex flex-wrap items-center gap-3"><button disabled={saving || uploadingLogo} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Enregistrement..." : "Sauvegarder"}</button>{msg && <p className="text-sm text-slate-500" role="status">{msg}</p>}</div>
    </form>
  </div>;
}

async function optimizeLogoFile(file: File) {
  if (file.size <= maxLogoBytes && file.type === "image/webp") return file;
  const bitmap = await createImageBitmap(file);
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  bitmap.close();
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
}

async function readSettingsError(response: Response) {
  try {
    const body = await response.json();
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    return message ? `Sauvegarde impossible : ${message}` : "Sauvegarde impossible. Vérifiez les champs puis réessayez.";
  } catch {
    return "Sauvegarde impossible. Vérifiez les champs puis réessayez.";
  }
}

function toCompanyForm(data: Partial<CompanyForm>): CompanyForm {
  const companyName = data.companyName ?? data.name ?? "";
  return {
    name: data.name ?? companyName,
    companyName,
    logoUrl: data.logoUrl?.startsWith("data:") ? "" : data.logoUrl ?? "",
    primaryColor: data.primaryColor ?? "#2563eb",
    phone: data.phone ?? "",
    whatsapp: data.whatsapp ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    city: data.city ?? "",
    country: data.country ?? "",
    taxNumber: data.taxNumber ?? "",
    currency: data.currency ?? "HTG",
    language: data.language ?? "fr",
    timezone: data.timezone ?? "America/Port-au-Prince"
  };
}

function toCompanyPayload(form: CompanyForm) {
  const companyName = form.companyName ?? form.name;
  return {
    name: companyName,
    companyName,
    logoUrl: form.logoUrl?.startsWith("data:") ? "" : form.logoUrl ?? "",
    primaryColor: form.primaryColor ?? "#2563eb",
    phone: form.phone ?? "",
    whatsapp: form.whatsapp ?? "",
    email: form.email ?? "",
    address: form.address ?? "",
    city: form.city ?? "",
    country: form.country ?? "",
    taxNumber: form.taxNumber ?? "",
    currency: form.currency ?? "HTG",
    language: form.language ?? "fr",
    timezone: form.timezone ?? "America/Port-au-Prince"
  };
}

function Header({ active }: { active: string }) {
  return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Paramètres</p><h1 className="text-2xl font-bold">Profil de l&apos;entreprise</h1><div className="mt-4 flex flex-wrap gap-2">{tabs.map(([label, href]) => <Link key={href} href={href} className={`rounded-md px-3 py-2 text-sm ${label === active ? "bg-brand-600 text-white" : "border"}`}>{label}</Link>)}</div></div>;
}

function Input({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<input value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="rounded-md border px-3 py-2 dark:bg-slate-950" /></label>;
}

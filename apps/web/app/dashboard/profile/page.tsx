"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { initials, resolveAssetUrl } from "@/lib/company-branding";
import { formatRole } from "@/lib/format";

const roleLabels: Record<string, string> = { OWNER: "Propriétaire", Owner: "Propriétaire", ADMIN: "Administrateur", CAISSIER: "Caissier", STOCK: "Stock", COMPTABLE: "Comptable", MANAGER: "Manager" };

type Profile = { name: string; firstName: string; lastName: string; email: string; role: string; createdAt: string; profile?: { photoUrl?: string | null; jobTitle?: string | null; phone?: string | null; language?: string | null }; tenant?: { name: string; companyProfile?: { companyName?: string | null; name?: string | null; logoUrl?: string | null } | null } };

export default function DashboardProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    const response = await fetchWithAuth(`${apiUrl}/profile/me`);
    if (response.ok) setProfile(await response.json());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;
    setMessage("");
    setSaving(true);
    try {
      const response = await fetchWithAuth(`${apiUrl}/profile/me`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: profile.name, jobTitle: profile.profile?.jobTitle ?? "", phone: profile.profile?.phone ?? "", language: profile.profile?.language ?? "fr" }) });
      if (!response.ok) {
        setMessage("Mise à jour impossible. Vérifiez les champs puis réessayez.");
        return;
      }
      setProfile(await response.json());
      setMessage("Profil mis à jour.");
    } catch {
      setMessage("Mise à jour impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <div className="text-sm text-slate-500">Chargement du profil...</div>;
  const photo = resolveAssetUrl(profile.profile?.photoUrl);
  const companyName = profile.tenant?.companyProfile?.companyName ?? profile.tenant?.companyProfile?.name ?? profile.tenant?.name ?? "Mon entreprise";
  const companyLogo = resolveAssetUrl(profile.tenant?.companyProfile?.logoUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {companyLogo ? <img src={companyLogo} alt={`Logo ${companyName}`} className="h-14 w-14 rounded-xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">{initials(companyName, "ME")}</div>}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Profil utilisateur</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{profile.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Entreprise associée : {companyName}</p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center gap-3">
          {photo ? <img src={photo} alt="Photo utilisateur" className="h-28 w-28 rounded-full object-cover" /> : <div className="flex h-28 w-28 items-center justify-center rounded-full bg-brand-100 text-3xl font-bold text-brand-700">{initials(profile.name, "U")}</div>}
          <p className="text-sm text-slate-500">Photo utilisateur</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Nom complet" value={profile.name} onChange={(value) => setProfile({ ...profile, name: value })} />
          <Input label="Fonction" value={formatProfileJobTitle(profile.profile?.jobTitle)} onChange={(value) => setProfile({ ...profile, profile: { ...profile.profile, jobTitle: value } })} />
          <Input label="Téléphone" value={profile.profile?.phone ?? ""} onChange={(value) => setProfile({ ...profile, profile: { ...profile.profile, phone: value } })} />
          <Input label="Email" value={profile.email} disabled onChange={() => undefined} />
          <Input label="Langue" value={profile.profile?.language ?? "fr"} onChange={(value) => setProfile({ ...profile, profile: { ...profile.profile, language: value } })} />
          <Input label="Rôle" value={displayRole(profile.role)} disabled onChange={() => undefined} />
          <Input label="Entreprise" value={companyName} disabled onChange={() => undefined} />
          {message ? <p className="md:col-span-2 text-sm font-semibold text-green-600">{message}</p> : null}
          <button disabled={saving} className="md:col-span-2 rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Enregistrement..." : "Sauvegarder"}</button>
        </div>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, disabled = false }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}<input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2.5 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800" /></label>;
}

function formatProfileJobTitle(jobTitle: string | null | undefined) {
  const value = formatRole(jobTitle);
  return value === "Session" ? "" : value;
}

function displayRole(role: string) {
  return formatRole(role);
}

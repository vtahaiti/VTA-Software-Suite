"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany } from "@/lib/auth";
import { getBusinessCatalog, type BusinessSector } from "@/lib/business-profiles";
import { resolveAssetUrl } from "@/lib/company-branding";
import { citiesForHaitiDepartment, haitiDepartmentNames } from "@/lib/haiti-locations";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));
const maxLogoBytes = 2 * 1024 * 1024;
const allowedLogoTypes = ["image/png", "image/jpeg", "image/webp"];

const citiesByCountry: Record<string, string[]> = {
  Haiti: citiesForHaitiDepartment("Nord"),
  "République dominicaine": ["Santiago", "Santo Domingo", "Dajabon"],
  Canada: ["Montreal", "Ottawa", "Toronto"],
  "États-Unis": ["Miami", "New York", "Boston"]
};

const currencies = ["HTG", "USD", "EUR", "DOP", "CAD"];
const colorOptions = [
  { label: "Bleu", value: "#2563eb", className: "bg-blue-600" },
  { label: "Vert", value: "#16a34a", className: "bg-green-600" },
  { label: "Orange", value: "#f97316", className: "bg-orange-500" },
  { label: "Rouge", value: "#dc2626", className: "bg-red-600" },
  { label: "Violet", value: "#7c3aed", className: "bg-violet-600" },
  { label: "Gris", value: "#475569", className: "bg-slate-600" }
];

const fallbackSectors: BusinessSector[] = [
  { key: "commerce", name: "Commerce / Market", description: "Boutiques, markets et vente générale.", specialties: [
    { name: "Épicerie / Market", profileType: "commerce", categories: ["Boissons", "Alimentation", "Snacks"] },
    { name: "Boutique", profileType: "commerce", categories: ["Produits", "Accessoires"] },
    { name: "Supermarché", profileType: "commerce", categories: ["Boissons", "Alimentation", "Hygiène"] },
    { name: "Vente générale", profileType: "commerce", categories: ["Général", "Produits"] },
    { name: "Autre commerce", profileType: "commerce", categories: ["Général"] }
  ] },
  { key: "restaurant-food", name: "Restaurant / Bar", description: "Restaurant, bar, fast-food et traiteur.", specialties: [
    { name: "Restaurant", profileType: "restaurant", categories: ["Plats", "Boissons", "Desserts"] },
    { name: "Bar", profileType: "restaurant", categories: ["Boissons", "Snacks"] },
    { name: "Fast-food", profileType: "restaurant", categories: ["Menus", "Plats", "Boissons"] }
  ] },
  { key: "construction", name: "Construction / Quincaillerie", description: "Matériaux et quincaillerie.", specialties: [
    { name: "Matériaux de construction", profileType: "construction-materials", categories: ["Ciment", "Fer", "Bois"] },
    { name: "Quincaillerie", profileType: "hardware", categories: ["Ciment", "Fer", "Peinture"] },
    { name: "Fabrication fenêtres/portes", profileType: "windows-aluminium", categories: ["Fenêtres", "Portes", "Aluminium"] }
  ] },
  { key: "multi-activities", name: "Services / Multi-activité", description: "Services et multi-activité.", specialties: [
    { name: "Multi-activité / Commerce & Services", profileType: "multi-activities", categories: ["Accessoires / Cadeaux", "Informatique", "Services"] }
  ] },
  { key: "other", name: "Autre activité", description: "Activité non listée.", specialties: [
    { name: "Autre activité", profileType: "commerce", categories: ["Général"] }
  ] }
];

const firstSector = fallbackSectors[0];
const firstSpecialty = firstSector.specialties[0];

const initialForm = {
  companyName: "",
  businessSector: firstSector.key,
  businessSpecialty: firstSpecialty.name,
  businessProfileSlug: firstSpecialty.profileType,
  secondaryActivities: [] as string[],
  country: "Haiti",
  department: "Nord",
  city: "Cap-Haitien",
  otherCity: "",
  address: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  taxNumber: "",
  currency: "HTG",
  language: "fr",
  timezone: "America/Port-au-Prince",
  primaryColor: "#2563eb",
  secondaryColor: "#0f172a",
  logoUrl: "",
  userPhotoDataUrl: ""
};

type CompanyForm = typeof initialForm;

export default function OnboardingCompanyPage() {
  const router = useRouter();
  const [pendingToken, setPendingToken] = useState("");
  const [sectors, setSectors] = useState<BusinessSector[]>(fallbackSectors);
  const [form, setForm] = useState<CompanyForm>(initialForm);
  const [error, setError] = useState("");
  const [hasCheckedPendingToken, setHasCheckedPendingToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);

  const selectedSector = useMemo(() => sectors.find((sector) => sector.key === form.businessSector) ?? sectors[0], [sectors, form.businessSector]);
  const selectedSpecialty = useMemo(() => selectedSector.specialties.find((specialty) => specialty.name === form.businessSpecialty) ?? selectedSector.specialties[0], [selectedSector, form.businessSpecialty]);
  const availableCities = form.country === "Haiti" ? [...citiesForHaitiDepartment(form.department), "Autre"] : citiesByCountry[form.country] ?? [];
  useEffect(() => {
    const token = window.localStorage.getItem("vta_pending_onboarding") ?? "";
    setPendingToken(token);
    setHasCheckedPendingToken(true);
    if (!token) setError("Session d'inscription introuvable ou expirée. Recommencez la création du compte.");

    getBusinessCatalog().then((catalog) => {
      const nextSectors = catalog.sectors?.length ? catalog.sectors : fallbackSectors;
      const sector = nextSectors[0];
      const specialty = sector.specialties[0];
      setSectors(nextSectors);
      setForm((current) => ({
        ...current,
        businessSector: sector.key,
        businessSpecialty: specialty.name,
        businessProfileSlug: specialty.profileType
      }));
    }).catch(() => undefined);
  }, []);

  useEffect(() => () => {
    if (localLogoPreview) URL.revokeObjectURL(localLogoPreview);
  }, [localLogoPreview]);

  function updateField<K extends keyof CompanyForm>(field: K, value: CompanyForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSector(sectorKey: string) {
    const sector = sectors.find((item) => item.key === sectorKey) ?? sectors[0];
    const specialty = sector.specialties[0];
    setForm((current) => ({
      ...current,
      businessSector: sector.key,
      businessSpecialty: specialty.name,
      businessProfileSlug: specialty.profileType,
      secondaryActivities: []
    }));
  }

  function updateSpecialty(name: string) {
    const specialty = selectedSector.specialties.find((item) => item.name === name) ?? selectedSector.specialties[0];
    setForm((current) => ({
      ...current,
      businessSpecialty: specialty.name,
      businessProfileSlug: specialty.profileType
    }));
  }

  function updateCountry(country: string) {
    if (country === "Haiti") {
      const cities = citiesForHaitiDepartment("Nord");
      setForm((current) => ({ ...current, country, department: "Nord", city: cities[0] ?? "", otherCity: "" }));
      return;
    }
    const cities = citiesByCountry[country] ?? [];
    setForm((current) => ({ ...current, country, department: "", city: cities[0] ?? "", otherCity: "" }));
  }

  function updateDepartment(department: string) {
    const cities = citiesForHaitiDepartment(department);
    setForm((current) => ({ ...current, department, city: cities[0] ?? "Autre", otherCity: "" }));
  }

  function updateCity(city: string) {
    setForm((current) => ({ ...current, city, otherCity: city === "Autre" ? current.otherCity : "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!pendingToken) {
      setError("Session d'inscription introuvable ou expirée. Recommencez la création du compte.");
      return;
    }
    const city = form.city === "Autre" ? form.otherCity.trim() : form.city;
    if (!city) {
      setError("Veuillez choisir ou saisir une commune/ville.");
      return;
    }
    const address = form.country === "Haiti" ? withDepartmentInAddress(form.address, form.department) : form.address;
    setIsLoading(true);
    try {
      await createCompany({
        pendingToken,
        companyName: form.companyName,
        businessCategory: form.businessSector,
        primaryActivity: form.businessSpecialty,
        businessProfileSlug: form.businessProfileSlug,
        secondaryActivities: form.secondaryActivities,
        industry: `${selectedSector.name} - ${form.businessSpecialty}`,
        country: form.country,
        city,
        address,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        website: form.website,
        taxNumber: form.taxNumber,
        currency: form.currency,
        language: form.language,
        timezone: form.timezone,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        logoUrl: form.logoUrl?.startsWith("data:") ? "" : form.logoUrl,
        userPhotoDataUrl: form.userPhotoDataUrl
      });
      window.localStorage.removeItem("vta_pending_onboarding");
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création de l'entreprise impossible.");
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!pendingToken) {
      setError("Session d'inscription introuvable ou expirée. Recommencez la création du compte.");
      return;
    }
    if (!allowedLogoTypes.includes(file.type)) {
      setError("Format non accepté. Utilisez PNG, JPG, JPEG ou WebP.");
      return;
    }
    setError("");
    setIsUploadingLogo(true);
    const previousLogoUrl = form.logoUrl;
    try {
      const optimized = await optimizeLogoFile(file);
      if (optimized.size > maxLogoBytes) {
        setError("Le fichier est trop grand. Taille maximale : 2 Mo.");
        return;
      }
      const previewUrl = URL.createObjectURL(optimized);
      if (localLogoPreview) URL.revokeObjectURL(localLogoPreview);
      setLocalLogoPreview(previewUrl);
      const body = new FormData();
      body.append("file", optimized, optimized.name);
      body.append("pendingToken", pendingToken);
      const response = await fetch(`${apiUrl}/uploads/company-logo`, { method: "POST", body });
      if (!response.ok) {
        updateField("logoUrl", previousLogoUrl);
        setLocalLogoPreview(null);
        setError(await readUploadError(response));
        return;
      }
      const result = await response.json() as { url?: string };
      if (!result.url) throw new Error("Logo non reçu.");
      updateField("logoUrl", result.url);
    } catch {
      updateField("logoUrl", previousLogoUrl);
      setError("Impossible de charger le logo. Vous pouvez continuer sans logo et l'ajouter plus tard.");
    } finally {
      setIsUploadingLogo(false);
    }
  }

  if (!hasCheckedPendingToken) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">Chargement de l&apos;inscription...</main>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 px-6 py-10 text-slate-950">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-100">Création entreprise</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Créez votre espace entreprise.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-blue-50">Choisissez d&apos;abord votre secteur, puis votre spécialité. VTA adapte ensuite les modules sans limiter les anciens profils.</p>
        </div>

        <form onSubmit={submit} className="rounded-[2rem] border border-white/20 bg-white p-6 shadow-2xl shadow-slate-950/30 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Espace entreprise</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Informations essentielles</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Quelques informations suffisent pour ouvrir votre espace.</p>
            </div>
            <label className="group grid cursor-pointer justify-items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              {localLogoPreview || form.logoUrl ? (
                <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white shadow-xl shadow-slate-200 ring-4 ring-white dark:bg-slate-950 dark:shadow-slate-950 dark:ring-slate-800">
                  <img src={localLogoPreview ?? resolveAssetUrl(form.logoUrl) ?? ""} alt="Logo entreprise" className="h-full w-full object-cover" />
                </span>
              ) : (
                <span className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-xl shadow-slate-200 ring-1 ring-slate-200 transition group-hover:scale-[1.02] dark:bg-slate-950 dark:text-blue-200 dark:shadow-slate-950 dark:ring-slate-700">Choisir un logo</span>
              )}
              <span className="text-xs text-blue-700 group-hover:underline dark:text-blue-300">{isUploadingLogo ? "Chargement..." : form.logoUrl ? "Changer le logo" : "Facultatif"}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={isUploadingLogo || !pendingToken} className="sr-only" />
            </label>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Input label="Nom de l'entreprise" value={form.companyName} required onChange={(value) => updateField("companyName", value)} />
            <Select label="Secteur" value={form.businessSector} required options={sectors.map((sector) => ({ value: sector.key, label: sector.name }))} onChange={updateSector} />
            <Select label="Spécialité" value={form.businessSpecialty} required options={selectedSector.specialties.map((specialty) => ({ value: specialty.name, label: specialty.name }))} onChange={updateSpecialty} />
            <ReadOnly label="Profil appliqué" value={selectedSpecialty.profileType} />
            <Select label="Pays" value={form.country} required options={Object.keys(citiesByCountry).map((country) => ({ value: country, label: country === "Haiti" ? "Haïti" : country }))} onChange={updateCountry} />
            {form.country === "Haiti" ? <Select label="Département" value={form.department} required options={haitiDepartmentNames.map((name) => ({ value: name, label: name }))} onChange={updateDepartment} /> : null}
            <Select label="Commune / Ville" value={form.city} required options={availableCities.map((city) => ({ value: city, label: city }))} onChange={updateCity} />
            {form.city === "Autre" ? <Input label="Commune / Ville autre" value={form.otherCity} required onChange={(value) => updateField("otherCity", value)} /> : null}
            <Input label="Adresse" value={form.address} required onChange={(value) => updateField("address", value)} />
            <Input label="Téléphone principal" value={form.phone} required type="tel" onChange={(value) => updateField("phone", value)} />
            <Input label="Email principal" value={form.email} required type="email" onChange={(value) => updateField("email", value)} />
            <Select label="Devise" value={form.currency} required options={currencies.map((currency) => ({ value: currency, label: currency }))} onChange={(value) => updateField("currency", value)} />
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Pour Haïti, le département est conservé dans l&apos;adresse de l&apos;entreprise sans migration de base de données.</p>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Couleur principale</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {colorOptions.map((color) => (
                <button type="button" key={color.value} onClick={() => updateField("primaryColor", color.value)} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition ${form.primaryColor === color.value ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100" : "border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"}`}>
                  <span className={`h-5 w-5 rounded-full ${color.className}`} />{color.label}
                </button>
              ))}
            </div>
          </div>

          <details className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">Informations facultatives</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input label="WhatsApp" value={form.whatsapp} type="tel" onChange={(value) => updateField("whatsapp", value)} />
              <Input label="Site web" value={form.website} type="url" onChange={(value) => updateField("website", value)} />
              <Input label="Numéro fiscal" value={form.taxNumber} onChange={(value) => updateField("taxNumber", value)} />
            </div>
          </details>

          {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
          <button disabled={isLoading || isUploadingLogo || !pendingToken} className="mt-6 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? "Création en cours..." : "Créer mon entreprise"}</button>
        </form>
      </section>
    </main>
  );
}

function Input({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; required?: boolean; type?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950" /></label>;
}

function Select({ label, value, options, onChange, required = false }: { label: string; value: string; options: Array<{ value: string; label: string }>; required?: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}<select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}<input readOnly value={value} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500 dark:border-slate-800 dark:bg-slate-950" /></label>;
}

function withDepartmentInAddress(address: string, department: string) {
  const cleanAddress = address.trim();
  if (!department) return cleanAddress;
  if (cleanAddress.toLowerCase().includes(`département: ${department.toLowerCase()}`)) return cleanAddress;
  return `${cleanAddress} - Département: ${department}`;
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

async function readUploadError(response: Response) {
  try {
    const body = await response.json();
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    return message ? `Logo non chargé : ${message}` : "Logo non chargé. Vous pouvez continuer sans logo.";
  } catch {
    return "Logo non chargé. Vous pouvez continuer sans logo.";
  }
}

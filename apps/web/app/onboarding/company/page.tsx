"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany } from "@/lib/auth";
import { getBusinessCatalog, type BusinessActivityTemplate, type BusinessCategory } from "@/lib/business-profiles";

const citiesByCountry: Record<string, string[]> = {
  Haïti: ["Cap-Haïtien", "Trou-du-Nord", "Ouanaminthe", "Fort-Liberté", "Limonade", "Quartier-Morin", "Milot", "Caracol", "Hinche", "Port-au-Prince"],
  "Republique dominicaine": ["Santiago", "Santo Domingo", "Dajabon"],
  Canada: ["Montreal", "Ottawa", "Toronto"],
  "Etats-Unis": ["Miami", "New York", "Boston"]
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

const fallbackActivityTemplates: BusinessActivityTemplate[] = [
  { label: "Commerce / Market", categoryKey: "commerce", profileType: "commerce", categories: ["Boissons", "Alimentation", "Snacks", "Hygiene", "Detergents"] },
  { label: "Pharmacie", categoryKey: "health", profileType: "pharmacy", categories: ["Medicaments", "Injections", "Vitamines", "Hygiene", "Bebe", "Premiers soins"] },
  { label: "Hotel", categoryKey: "hotel", profileType: "hotel", categories: ["Chambres", "Services", "Restaurant", "Blanchisserie"] },
  { label: "Restaurant", categoryKey: "restaurant-food", profileType: "restaurant", categories: ["Plats", "Boissons", "Desserts", "Menus"] },
  { label: "Fabrication", categoryKey: "manufacturing", profileType: "manufacturing", categories: ["Matieres premieres", "Produits finis", "Aluminium", "Vitres", "Portes", "Fenetres", "Accessoires"] },
  { label: "Portes / Fenetres / Aluminium", categoryKey: "construction", profileType: "windows-aluminium", categories: ["Aluminium", "Vitres", "Portes", "Fenetres", "Accessoires", "Matieres premieres", "Produits finis"] },
  { label: "Materiaux de construction", categoryKey: "construction", profileType: "construction-materials", categories: ["Ciment", "Fer", "Bois", "Peinture", "Plomberie", "Electricite"] },
  { label: "Quincaillerie", categoryKey: "construction", profileType: "hardware", categories: ["Ciment", "Fer", "Bois", "Peinture", "Plomberie", "Electricite"] },
  { label: "Ecole", categoryKey: "education", profileType: "school", categories: ["Frais scolaires", "Uniformes", "Livres", "Services", "Transport"] },
  { label: "Multi-activite / Commerce & Services", categoryKey: "multi-activities", profileType: "multi-activities", categories: ["Accessoires / Cadeaux", "Informatique", "Impression", "Studio photo", "Bois / Fabrication", "Services"] },
  { label: "Autre", categoryKey: "other", profileType: "commerce", categories: ["General"] }
];

const fallbackCategories: BusinessCategory[] = [
  { key: "commerce", name: "Commerce", description: "Boutiques et markets.", activities: [{ name: "Boutique / Market", profileType: "commerce" }] },
  { key: "other", name: "Autre", description: "Activite non listee.", activities: [{ name: "Autre activite", profileType: "commerce" }] }
];

const initialForm = {
  companyName: "",
  activityLabel: "Commerce / Market",
  businessCategory: "commerce",
  primaryActivity: "Commerce / Market",
  businessProfileSlug: "commerce",
  secondaryActivities: [] as string[],
  country: "Haïti",
  city: "Cap-Haïtien",
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
  logoDataUrl: "",
  userPhotoDataUrl: ""
};

type CompanyForm = typeof initialForm;

export default function OnboardingCompanyPage() {
  const router = useRouter();
  const [pendingToken, setPendingToken] = useState("");
  const [categories, setCategories] = useState<BusinessCategory[]>(fallbackCategories);
  const [activityTemplates, setActivityTemplates] = useState<BusinessActivityTemplate[]>(fallbackActivityTemplates);
  const [form, setForm] = useState<CompanyForm>(initialForm);
  const [error, setError] = useState("");
  const [hasCheckedPendingToken, setHasCheckedPendingToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const availableCities = citiesByCountry[form.country] ?? [];
  const initials = useMemo(() => getInitials(form.companyName), [form.companyName]);

  useEffect(() => {
    const token = window.localStorage.getItem("vta_pending_onboarding") ?? "";
    setPendingToken(token);
    setHasCheckedPendingToken(true);
    if (!token) {
      setError("Session d'inscription introuvable ou expirée. Recommencez la création du compte.");
    }
    getBusinessCatalog().then((catalog) => {
      setCategories(catalog.categories.length ? catalog.categories : fallbackCategories);
      setActivityTemplates(catalog.activityTemplates?.length ? catalog.activityTemplates : fallbackActivityTemplates);
    }).catch(() => undefined);
  }, []);

  function updateField<K extends keyof CompanyForm>(field: K, value: CompanyForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCountry(country: string) {
    const cities = citiesByCountry[country] ?? [];
    setForm((current) => ({ ...current, country, city: cities[0] ?? "" }));
  }

  function updateActivity(label: string) {
    const selected = activityTemplates.find((option) => option.label === label) ?? activityTemplates[0];
    const category = categories.find((item) => item.key === selected.categoryKey) ?? fallbackCategories[0];
    setForm((current) => ({
      ...current,
      activityLabel: selected.label,
      businessCategory: category.key,
      primaryActivity: selected.label,
      businessProfileSlug: selected.profileType,
      secondaryActivities: []
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!pendingToken) {
      setError("Session d'inscription introuvable ou expirée. Recommencez la création du compte.");
      return;
    }
    setIsLoading(true);
    try {
      await createCompany({
        pendingToken,
        companyName: form.companyName,
        businessCategory: form.businessCategory,
        primaryActivity: form.primaryActivity,
        businessProfileSlug: form.businessProfileSlug,
        secondaryActivities: form.secondaryActivities,
        industry: form.activityLabel,
        country: form.country,
        city: form.city,
        address: form.address,
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
        logoDataUrl: form.logoDataUrl || createInitialsLogoDataUrl(initials, form.primaryColor),
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
    if (!file) return;
    updateField("logoDataUrl", await fileToDataUrl(file));
  }

  if (!hasCheckedPendingToken) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">Chargement de l&apos;inscription...</main>;
  }

  return <main className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 px-6 py-10 text-slate-950"><section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]"><div className="text-white"><p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-100">Création entreprise</p><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Créez votre espace entreprise.</h1><p className="mt-5 max-w-xl text-lg leading-8 text-blue-50">Renseignez les informations essentielles pour commencer a utiliser votre espace.</p></div><form onSubmit={submit} className="rounded-[2rem] border border-white/20 bg-white p-6 shadow-2xl shadow-slate-950/30 dark:border-slate-800 dark:bg-slate-900 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Espace entreprise</p><h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Informations essentielles</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Quelques informations suffisent pour ouvrir votre espace.</p></div><label className="group grid cursor-pointer justify-items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">{form.logoDataUrl ? <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white shadow-xl shadow-slate-200 ring-4 ring-white dark:bg-slate-950 dark:shadow-slate-950 dark:ring-slate-800"><img src={form.logoDataUrl} alt="Logo entreprise" className="h-full w-full object-cover" /></span> : <span className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-xl shadow-slate-200 ring-1 ring-slate-200 transition group-hover:scale-[1.02] dark:bg-slate-950 dark:text-blue-200 dark:shadow-slate-950 dark:ring-slate-700">📷 Choisir un logo</span>}<span className="text-xs text-blue-700 group-hover:underline dark:text-blue-300">{form.logoDataUrl ? "Changer le logo" : "Facultatif"}</span><input type="file" accept="image/*" onChange={uploadLogo} className="sr-only" /></label></div><div className="mt-8 grid gap-4 md:grid-cols-2"><Input label="Nom de l&apos;entreprise" value={form.companyName} required onChange={(value)=>updateField("companyName", value)} /><Select label="Activité principale" value={form.activityLabel} required options={activityTemplates.map((activity)=>activity.label)} onChange={updateActivity} /><Select label="Pays" value={form.country} required options={Object.keys(citiesByCountry)} onChange={updateCountry} /><Select label="Ville" value={form.city} required options={availableCities} onChange={(value)=>updateField("city", value)} /><Input label="Adresse" value={form.address} required onChange={(value)=>updateField("address", value)} /><Input label="Téléphone principal" value={form.phone} required type="tel" onChange={(value)=>updateField("phone", value)} /><Input label="Email principal" value={form.email} required type="email" onChange={(value)=>updateField("email", value)} /><Select label="Devise" value={form.currency} required options={currencies} onChange={(value)=>updateField("currency", value)} /></div><div className="mt-6"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Couleur principale</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{colorOptions.map((color)=><button type="button" key={color.value} onClick={()=>updateField("primaryColor", color.value)} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition ${form.primaryColor===color.value?"border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100":"border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"}`}><span className={`h-5 w-5 rounded-full ${color.className}`} />{color.label}</button>)}</div></div><details className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"><summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">Informations facultatives</summary><div className="mt-4 grid gap-4 md:grid-cols-2"><Input label="WhatsApp" value={form.whatsapp} type="tel" onChange={(value)=>updateField("whatsapp", value)} /><Input label="Site web" value={form.website} type="url" onChange={(value)=>updateField("website", value)} /><Input label="Numéro fiscal" value={form.taxNumber} onChange={(value)=>updateField("taxNumber", value)} /></div></details>{error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}<button disabled={isLoading || !pendingToken} className="mt-6 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? "Création en cours..." : "Créer mon entreprise"}</button></form></section></main>;
}

function Input({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; required?: boolean; type?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}<input required={required} type={type} value={value} onChange={(event)=>onChange(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950" /></label>;
}

function Select({ label, value, options, onChange, required = false }: { label: string; value: string; options: string[]; required?: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}<select required={required} value={value} onChange={(event)=>onChange(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950">{options.map((option)=><option key={option} value={option}>{option}</option>)}</select></label>;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ME";
  return parts.slice(0, 2).map((part)=>part[0]?.toUpperCase()).join("") || "ME";
}

function createInitialsLogoDataUrl(initials: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="128" fill="${color}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="82" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

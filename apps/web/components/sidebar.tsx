"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fallbackMenuSections, getTenantBusinessConfiguration, type BusinessMenuSection } from "@/lib/business-profiles";
import { CompanyBranding, getCompanyBranding } from "@/lib/company-branding";
import { getAccessToken, getCurrentUser } from "@/lib/auth";

type MenuMode = "simple" | "expert";

export function Sidebar() {
  const pathname = usePathname();
  const [mode, setMode] = useState<MenuMode>("simple");
  const [simpleSections, setSimpleSections] = useState<BusinessMenuSection[]>(fallbackMenuSections);
  const [expertSections, setExpertSections] = useState<BusinessMenuSection[]>(fallbackMenuSections);
  const [activity, setActivity] = useState("");
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  useEffect(() => {
    setMode((window.localStorage.getItem("vta_menu_mode") as MenuMode) || "simple");
    let mounted = true;
    getTenantBusinessConfiguration().then((configuration) => {
      if (!mounted || !configuration) return;
      setSimpleSections(configuration.simpleMenuSections?.length ? configuration.simpleMenuSections : fallbackMenuSections);
      setExpertSections(configuration.expertMenuSections?.length ? configuration.expertMenuSections : configuration.menuSections.length ? configuration.menuSections : fallbackMenuSections);
      setActivity(configuration.primaryActivity ?? "");
    }).catch(() => undefined);
    const token = getAccessToken();
    if (token) {
      getCompanyBranding(token).then((value) => { if (mounted) setBranding(value); }).catch(() => undefined);
    }
    return () => { mounted = false; };
  }, []);

  function toggleMode() {
    const next = mode === "simple" ? "expert" : "simple";
    setMode(next);
    window.localStorage.setItem("vta_menu_mode", next);
  }

  const sections = decorateMenuSections(mode === "simple" ? simpleSections : expertSections);
  const currentUser = getCurrentUser();
  const companyName = branding?.companyName ?? currentUser?.tenant ?? "Mon entreprise";
  const companyInitials = branding?.companyInitials ?? initials(companyName);
  const primaryColor = branding?.primaryColor ?? "#2563eb";

  return <aside className="border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950 lg:min-h-screen lg:border-b-0 lg:border-r">
    <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-lg font-bold text-slate-950 transition hover:bg-slate-50 dark:text-white dark:hover:bg-slate-900">
      {branding?.logoUrl ? <img src={branding.logoUrl} alt={`Logo ${companyName}`} className="h-10 w-10 rounded-md object-cover shadow-sm" /> : <span className="flex h-10 w-10 items-center justify-center rounded-md text-sm text-white shadow-sm" style={{ backgroundColor: primaryColor }}>{companyInitials}</span>}
      <span className="min-w-0 truncate">{companyName}</span>
    </Link>
    <div className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 dark:bg-slate-900 dark:text-brand-200">{activity || "Interface simple"}</div>
    <button onClick={toggleMode} className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">{mode === "simple" ? "Passer en mode expert" : "Revenir au mode simple"}</button>
    <nav className="mt-6 space-y-5">{sections.map((section)=><div key={section.title}><p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{section.title}</p><div className="mt-2 grid gap-1">{section.items.map((item)=>{const isActive=pathname===item.href;return <Link key={`${section.title}-${item.href}-${item.label}`} href={item.href} className={`rounded-md px-3 py-2 text-sm font-medium transition ${isActive?"bg-brand-50 text-brand-700 dark:bg-slate-900 dark:text-white":"text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"}`}>{item.label}</Link>})}</div></div>)}</nav>
  </aside>;
}

function decorateMenuSections(sections: BusinessMenuSection[]) {
  return sections.map((section) => ({
    ...section,
    items: section.items.flatMap((item) => {
      if (item.href === "/dashboard/products") {
        return [
          item,
          { label: "   Tous les produits", href: "/dashboard/products" },
          { label: "   Catégories", href: "/dashboard/products/categories" },
          { label: "   Ajouter une catégorie", href: "/dashboard/products/categories" }
        ];
      }
      if (item.href === "/dashboard/pos" && item.label.includes("Nouvelle vente")) {
        return [
          item,
          { label: "   En cours", href: "/dashboard/sales/in-progress" },
          { label: "   Terminées", href: "/dashboard/sales/completed" }
        ];
      }
      return [item];
    })
  }));
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

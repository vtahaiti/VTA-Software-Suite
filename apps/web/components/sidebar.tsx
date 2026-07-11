"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fallbackMenuSections, getTenantBusinessConfiguration, type BusinessMenuSection } from "@/lib/business-profiles";
import { CompanyBranding, getCompanyBranding } from "@/lib/company-branding";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { canAccessHref, canManageUsers } from "@/lib/role-access";

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

  const currentUser = getCurrentUser();
  const sections = filterMenuSections(decorateMenuSections(mode === "simple" ? simpleSections : expertSections), currentUser);
  const companyName = branding?.companyName ?? currentUser?.tenant ?? "Mon entreprise";
  const companyInitials = branding?.companyInitials ?? initials(companyName);
  const primaryColor = branding?.primaryColor ?? "#2563eb";

  return <aside className="sticky top-0 h-screen overflow-y-auto border-r border-slate-200 bg-white px-2 py-3 dark:border-slate-800 dark:bg-slate-950 lg:px-4 lg:py-5">
    <Link href="/dashboard" className="flex items-center justify-center gap-3 rounded-lg px-1 py-2 text-lg font-bold text-slate-950 transition hover:bg-slate-50 dark:text-white dark:hover:bg-slate-900 lg:justify-start lg:px-3">
      {branding?.logoUrl ? <img src={branding.logoUrl} alt={`Logo ${companyName}`} className="h-10 w-10 rounded-md object-cover shadow-sm" /> : <span className="flex h-10 w-10 items-center justify-center rounded-md text-sm text-white shadow-sm" style={{ backgroundColor: primaryColor }}>{companyInitials}</span>}
      <span className="hidden min-w-0 truncate lg:block">{companyName}</span>
    </Link>
    <div className="mt-4 hidden rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 dark:bg-slate-900 dark:text-brand-200 lg:block">{activity || "Interface simple"}</div>
    <button onClick={toggleMode} className="mt-3 hidden w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 lg:block">{mode === "simple" ? "Passer en mode expert" : "Revenir au mode simple"}</button>
    <nav className="mt-4 space-y-2 lg:mt-6 lg:space-y-5">{sections.map((section)=><div key={section.title}><p className="hidden px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">{section.title}</p><div className="grid gap-1 lg:mt-2">{section.items.map((item)=>{const isActive=pathname===item.href;const isSubItem=item.label.startsWith("   ");return <Link key={`${section.title}-${item.href}-${item.label}`} href={item.href} title={item.label.trim()} className={`${isSubItem ? "hidden lg:flex" : "flex"} items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium transition lg:justify-start lg:rounded-md lg:px-3 lg:py-2 ${isActive?"bg-brand-50 text-brand-700 dark:bg-slate-900 dark:text-white":"text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"}`}><span className="text-xl leading-none lg:hidden" aria-hidden="true">{mobileMenuIcon(item.label)}</span><span className="hidden lg:inline">{item.label}</span><span className="sr-only">{item.label.trim()}</span></Link>})}</div></div>)}</nav>
  </aside>;
}

function decorateMenuSections(sections: BusinessMenuSection[]) {
  const decorated = sections.map((section) => ({
    ...section,
    items: section.items.flatMap((item) => {
      if (item.href === "/dashboard/products") {
        return [
          item,
          { label: "   Catégories", href: "/dashboard/products/categories" }
        ];
      }
      if (item.href === "/dashboard/pos" && item.label.includes("Nouvelle vente")) {
        return [
          item,
          { label: "   En cours", href: "/dashboard/sales/in-progress" },
          { label: "   Terminées", href: "/dashboard/sales/completed" }
        ];
      }
      if (item.href === "/dashboard/settings/company") {
        return [
          item,
          { label: "   Emails", href: "/dashboard/settings/emails" }
        ];
      }
      return [item];
    })
  }));
  return decorated;
}

function filterMenuSections(sections: BusinessMenuSection[], user: ReturnType<typeof getCurrentUser>) {
  const filtered = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccessHref(user, item.href))
  })).filter((section) => section.items.length > 0);

  if (canManageUsers(user) && !filtered.some((section) => section.items.some((item) => item.href === "/dashboard/users"))) {
    filtered.push({ title: "Administration", items: [{ label: "👤 Rôles & Utilisateurs", href: "/dashboard/users" }] });
  }

  return filtered;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

function mobileMenuIcon(label: string) {
  const value = label.trim();
  const first = value.split(" ")[0] ?? "";
  return first.length <= 3 ? first : value[0]?.toUpperCase() ?? "•";
}

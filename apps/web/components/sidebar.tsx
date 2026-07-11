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
    <nav className="mt-4 space-y-2 lg:mt-6 lg:space-y-5">{sections.map((section)=><div key={section.title}><p className="hidden px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">{section.title}</p><div className="grid gap-1 lg:mt-2">{section.items.map((item)=>{const isActive=pathname===item.href;const isSubItem=item.label.startsWith("   ");const label=cleanMenuLabel(item.label);return <Link key={`${section.title}-${item.href}-${item.label}`} href={item.href} title={label} className={`${isSubItem ? "hidden lg:flex" : "flex"} items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium transition lg:justify-start lg:rounded-md lg:px-3 lg:py-2 ${isActive?"bg-brand-50 text-brand-700 dark:bg-slate-900 dark:text-white":"text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"}`}><MenuIcon href={item.href} label={label} /><span className="hidden lg:inline">{isSubItem ? `   ${label}` : label}</span><span className="sr-only">{label}</span></Link>})}</div></div>)}</nav>
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
          { label: "   Ventes en attente", href: "/dashboard/sales/in-progress" },
          { label: "   Historique", href: "/dashboard/sales/completed" }
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
    filtered.push({ title: "Administration", items: [{ label: "Rôles & Utilisateurs", href: "/dashboard/users" }] });
  }

  return filtered;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME";
}

function cleanMenuLabel(label: string) {
  const cleaned = label
    .trim()
    .replace(/^[^\wÀ-ÿ]+/u, "")
    .trim();
  return cleaned === "Nouvelle vente" ? "Vente" : cleaned;
}

function MenuIcon({ href, label }: { href: string; label: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {iconForHref(href, label)}
    </svg>
  );
}

function iconForHref(href: string, label: string) {
  if (href === "/dashboard") return <><path d="m3 10 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>;
  if (href.includes("/pos") || href.includes("/sales")) return <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.4 12.3a2 2 0 0 0 2 1.7h8.8a2 2 0 0 0 2-1.6L23 6H6" /></>;
  if (href.includes("/products")) return <><path d="m21 16-9 5-9-5V8l9-5 9 5v8Z" /><path d="m3.3 7.6 8.7 5 8.7-5" /><path d="M12 22V12" /></>;
  if (href.includes("/stock") || href.includes("/inventory")) return <><path d="M3 7h18" /><path d="M5 7v13h14V7" /><path d="M8 7V4h8v3" /><path d="M9 12h6" /></>;
  if (href.includes("/customers") || href.includes("/users")) return <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>;
  if (href.includes("/suppliers") || href.includes("/purchases")) return <><path d="M10 17h4V5H2v12h3" /><path d="M14 17h1a3 3 0 0 0 6 0h1v-5l-3-4h-5" /><circle cx="7" cy="17" r="3" /><circle cx="18" cy="17" r="3" /></>;
  if (href.includes("/reports")) return <><path d="M3 3v18h18" /><path d="M7 15v2" /><path d="M12 9v8" /><path d="M17 5v12" /></>;
  if (href.includes("/settings")) return <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" /></>;
  return label.toLowerCase().includes("fact") ? <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" /><path d="M9 7h6" /><path d="M9 11h6" /><path d="M9 15h4" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 8v8" /><path d="M8 12h8" /></>;
}

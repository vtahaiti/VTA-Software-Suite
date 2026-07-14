"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { fallbackMenuSections, getTenantBusinessConfiguration, type BusinessMenuSection } from "@/lib/business-profiles";
import { CompanyBranding, getCompanyBranding, initials } from "@/lib/company-branding";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { buildNavigation, isNavigationItemActive, navigationIcons, type NavigationItem } from "@/lib/navigation";

type MenuMode = "simple" | "full";

type SidebarProps = {
  className?: string;
  forceExpanded?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ className = "", forceExpanded = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [mode, setMode] = useState<MenuMode>("simple");
  const [simpleSections, setSimpleSections] = useState<BusinessMenuSection[]>(fallbackMenuSections);
  const [expertSections, setExpertSections] = useState<BusinessMenuSection[]>(fallbackMenuSections);
  const [activity, setActivity] = useState("");
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  useEffect(() => {
    const storedMode = window.localStorage.getItem("vta_menu_mode");
    setMode(storedMode === "expert" || storedMode === "full" ? "full" : "simple");
    let mounted = true;
    async function loadBranding() {
      const token = getAccessToken();
      if (token) {
        const value = await getCompanyBranding(token).catch(() => null);
        if (mounted) setBranding(value);
      }
    }
    getTenantBusinessConfiguration().then((configuration) => {
      if (!mounted || !configuration) return;
      setSimpleSections(configuration.simpleMenuSections?.length ? configuration.simpleMenuSections : fallbackMenuSections);
      setExpertSections(configuration.expertMenuSections?.length ? configuration.expertMenuSections : configuration.menuSections.length ? configuration.menuSections : fallbackMenuSections);
      setActivity(configuration.primaryActivity ?? "");
    }).catch(() => undefined);
    void loadBranding();
    window.addEventListener("vta:branding-updated", loadBranding);
    return () => {
      mounted = false;
      window.removeEventListener("vta:branding-updated", loadBranding);
    };
  }, []);

  function toggleMode() {
    const next = mode === "simple" ? "full" : "simple";
    setMode(next);
    window.localStorage.setItem("vta_menu_mode", next);
  }

  const currentUser = useMemo(() => getCurrentUser(), []);
  const sourceSections = mode === "simple" ? simpleSections : expertSections;
  const sections = useMemo(() => buildNavigation(currentUser, sourceSections), [currentUser, sourceSections]);
  const companyName = branding?.companyName ?? currentUser?.tenant ?? "Mon entreprise";
  const companyInitials = branding?.companyInitials ?? initials(companyName);
  const primaryColor = branding?.primaryColor ?? "#2563eb";

  useEffect(() => {
    let activeGroupId: string | null = null;
    for (const section of sections) {
      for (const item of section.items) {
        if (item.children?.length && isNavigationItemActive(pathname, item)) activeGroupId = item.id;
      }
    }
    setOpenGroupId(activeGroupId);
  }, [pathname, sections]);

  return <aside className={`h-full max-h-[100dvh] overflow-y-auto overscroll-contain border-r border-slate-200 bg-white px-2 py-3 dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:top-0 lg:h-screen lg:px-4 lg:py-5 ${className}`}>
    <Link href="/dashboard" title={companyName} onClick={onNavigate} className={`flex items-center gap-3 rounded-lg px-1 py-2 text-lg font-bold text-slate-950 transition hover:bg-slate-50 dark:text-white dark:hover:bg-slate-900 lg:justify-start lg:px-3 ${forceExpanded ? "justify-start" : "justify-center"}`}>
      {branding?.logoUrl ? <>
        {/* eslint-disable-next-line @next/next/no-img-element -- tenant logos are runtime URLs outside the static Next image allowlist */}
        <img src={branding.logoUrl} alt={`Logo ${companyName}`} className="h-10 w-10 rounded-md object-contain shadow-sm" />
      </> : <span className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white shadow-sm" style={{ backgroundColor: primaryColor }}>{companyInitials}</span>}
      <span className={`${forceExpanded ? "block" : "hidden"} min-w-0 truncate lg:block`}>{companyName}</span>
    </Link>
    <div className="mt-4 hidden rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300 lg:block">{activity || "Interface simple"}</div>
    <button onClick={toggleMode} title="Change uniquement l'affichage des menus autorisés." className="mt-3 hidden w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 lg:block">{mode === "simple" ? "Interface complète" : "Interface simplifiée"}</button>
    <nav className="mt-4 space-y-4 lg:mt-6" aria-label="Navigation principale">
      {sections.map((section) => <div key={section.title}>
        <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:block">{section.title}</p>
        <div className="grid gap-1">
          {section.items.map((item) => <SidebarItem key={item.id} item={item} pathname={pathname} forceExpanded={forceExpanded} isOpen={openGroupId === item.id} onToggle={() => setOpenGroupId((current) => current === item.id && !isNavigationItemActive(pathname, item) ? null : item.id)} onNavigate={onNavigate} />)}
        </div>
      </div>)}
    </nav>
  </aside>;
}

function SidebarItem({ item, pathname, forceExpanded, isOpen, onToggle, onNavigate }: { item: NavigationItem; pathname: string; forceExpanded: boolean; isOpen: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const Icon = item.icon;
  const Chevron = navigationIcons.Chevron;
  const active = isNavigationItemActive(pathname, item);
  const directActive = pathname === item.href;
  const baseClass = `flex h-11 w-full items-center gap-2 rounded-md px-2 text-sm transition lg:justify-start lg:px-3 ${forceExpanded ? "justify-start" : "justify-center"} ${active ? "bg-brand-50 font-semibold text-brand-700 dark:bg-slate-900 dark:text-white" : "font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"}`;
  function handleChildClick(event: MouseEvent<HTMLAnchorElement>) {
    event.stopPropagation();
    onNavigate?.();
  }

  function handleDirectClick() {
    onNavigate?.();
  }

  if (item.children?.length) {
    return <div className="relative">
      <button type="button" title={item.label} aria-expanded={isOpen} onClick={onToggle} className={baseClass}>
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className={`${forceExpanded ? "block" : "hidden"} min-w-0 flex-1 truncate text-left lg:block`}>{item.label}</span>
        <Chevron aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        <span className="sr-only">{item.label}</span>
      </button>
      {isOpen ? <div className="mt-1 grid gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/60 lg:ml-5 lg:border-y-0 lg:border-r-0 lg:border-l lg:bg-transparent lg:p-0 lg:pl-3 dark:lg:border-slate-800">
        {item.children.map((child) => {
          const ChildIcon = child.icon;
          const childActive = isNavigationItemActive(pathname, child);
          return <Link key={child.id} href={child.href} title={child.label} onClick={handleChildClick} className={`flex h-10 items-center justify-start gap-2 rounded-md px-3 text-sm transition ${childActive ? "bg-brand-50 font-semibold text-brand-700 dark:bg-slate-900 dark:text-white" : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"}`}>
            <ChildIcon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            <span className="min-w-0 truncate">{child.label}</span>
          </Link>;
        })}
      </div> : null}
    </div>;
  }

  return <Link href={item.href} title={item.label} aria-current={directActive ? "page" : undefined} onClick={handleDirectClick} className={baseClass}>
    <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
    <span className={`${forceExpanded ? "inline" : "hidden"} min-w-0 truncate lg:inline`}>{item.label}</span>
    <span className="sr-only">{item.label}</span>
  </Link>;
}

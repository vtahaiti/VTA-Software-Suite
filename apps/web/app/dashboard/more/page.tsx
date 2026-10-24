"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users, BarChart3, Printer, RefreshCw, Settings, LogOut } from "lucide-react";
import { buildNavigation } from "@/lib/navigation";
import { getTenantBusinessConfiguration, fallbackMenuSections, type BusinessMenuSection } from "@/lib/business-profiles";
import { canAccessHref } from "@/lib/role-access";
import { getCurrentUser, logout } from "@/lib/auth";
import { IosSubscriptionCard, IosPlanBadge } from "@/components/ios-plan-access";

const shortcuts = [
  { href: "/dashboard/customers", label: "Clients", icon: Users },
  { href: "/dashboard/reports", label: "Rapports", icon: BarChart3 },
  { href: "/dashboard/settings/pos", label: "Impression", icon: Printer },
  { href: "/offline", label: "Hors ligne", icon: RefreshCw }
];
export default function MorePage() {
  const [sections, setSections] = useState<BusinessMenuSection[]>(fallbackMenuSections);
  useEffect(() => {
    let active = true;
    const refresh = () => { void getTenantBusinessConfiguration().then(config => {
      if (active && config) setSections(config.expertMenuSections?.length ? config.expertMenuSections : config.menuSections);
    }).catch(() => undefined); };
    refresh();
    window.addEventListener("vta:business-profile-updated", refresh);
    return () => { active = false; window.removeEventListener("vta:business-profile-updated", refresh); };
  }, []);
  const user = getCurrentUser();
  const navigation = buildNavigation(user, sections);
  const allowed = (href: string) => !!user && canAccessHref(user, href === "/offline" ? "/dashboard/pos" : href);
  return <div className="vm-screen"><div className="vm-title"><h1>Plus</h1></div><IosSubscriptionCard/><Link className="vm-account-link" href="/dashboard/profile"><span className="vm-person-avatar">{user?.name?.slice(0,1).toUpperCase() || "V"}</span><div><strong>{user?.name || "Mon compte"}</strong><small>Voir mon profil</small></div><ChevronRight size={18}/></Link><nav className="vm-quick-grid" aria-label="Raccourcis">{shortcuts.filter(item => allowed(item.href)).map(item => <Link key={item.href} href={item.href}><span><item.icon size={22}/></span>{item.label}</Link>)}</nav>{navigation.map(section => {
    const items = section.items.filter(item => item.href !== "/dashboard" && item.href !== "/dashboard/profile");
    if (!items.length) return null;
    return <section className="vm-menu-section" key={section.title}><h2>{section.title}</h2><div className="vm-menu-group">{items.map(item => item.children?.length ? <details className="vm-menu-details" key={item.id}><summary className="vm-menu-row"><span><item.icon size={20}/></span><div><strong>{item.label}</strong><IosPlanBadge href={item.href}/></div><ChevronRight size={17}/></summary><div className="vm-submenu">{item.children.map(child => <Link href={child.href} key={child.id}>{child.label}<IosPlanBadge href={child.href}/><ChevronRight size={15}/></Link>)}</div></details> : <Link className="vm-menu-row" key={item.id} href={item.href}><span><item.icon size={20}/></span><div><strong>{item.label}</strong><IosPlanBadge href={item.href}/></div><ChevronRight size={17}/></Link>)}</div></section>;
  })}{allowed("/dashboard/settings") && <Link className="vm-menu-row vm-menu-group" href="/dashboard/settings"><span><Settings size={20}/></span><div><strong>Tous les paramètres</strong></div><ChevronRight size={17}/></Link>}<button className="vm-logout" onClick={async () => { await logout(); window.location.href = "/"; }}><LogOut size={19}/>Se déconnecter</button></div>;
}

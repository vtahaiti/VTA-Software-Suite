"use client";
import Link from "next/link";
import { Building2, ChevronRight, CreditCard, FileText, Layers, Mail, Printer, ShieldCheck, Settings } from "lucide-react";
import { canAccessHref } from "@/lib/role-access";
import { getCurrentUser } from "@/lib/auth";
const icons = [Building2, Layers, Printer, FileText, CreditCard, Mail, ShieldCheck];
export function IosSettingsMenu({ sections, advanced }: { sections: { title: string; href: string; description: string }[]; advanced: { title: string; href: string; description: string }[] }) {
  return <div className="vm-screen"><div className="vm-title"><h1>Paramètres</h1></div><section className="vm-menu-section"><h2>Mon entreprise</h2><div className="vm-menu-group">{sections.filter(item => canAccessHref(getCurrentUser(), item.href)).map((item,index) => { const Icon = icons[index] || Settings;return <Link className="vm-menu-row" key={item.href} href={item.href}><span><Icon size={20}/></span><div><strong>{item.title}</strong><small>{item.description}</small></div><ChevronRight size={17}/></Link>; })}</div></section><details className="vm-advanced"><summary>Réglages avancés</summary><div className="vm-menu-group">{advanced.map(item => <Link className="vm-menu-row" href={item.href} key={item.href}><div><strong>{item.title}</strong></div><ChevronRight size={17}/></Link>)}</div></details></div>;
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Package, MoreHorizontal } from "lucide-react";

export function IosBottomNav({ guest = false }: { guest?: boolean }) {
  const pathname = usePathname().replace(/\/$/, "");
  const tabs = [
    { label: "Accueil", href: "/dashboard", icon: Home },
    { label: "Vendre", href: "/dashboard/pos", icon: ShoppingCart },
    { label: "Stock", href: "/dashboard/inventory", icon: Package },
    { label: "Plus", href: "/dashboard/more", icon: MoreHorizontal }
  ];
  return <nav aria-label="Navigation principale" className="ios-bottom-nav">
    {tabs.map(({ label, href, icon: Icon }) => {
      const active = guest ? label === "Vendre" : label === "Accueil" ? pathname === href : label === "Vendre" ? pathname.startsWith(href) : label === "Stock" ? pathname.startsWith("/dashboard/inventory") || pathname.startsWith("/dashboard/products") : !["/dashboard", "/dashboard/pos"].includes(pathname) && !pathname.startsWith("/dashboard/inventory") && !pathname.startsWith("/dashboard/products");
      return <Link key={label} href={guest ? label === "Vendre" ? "/" : "/login" : href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""}><Icon aria-hidden="true" size={21} strokeWidth={active ? 2.6 : 2} /><span>{label}</span></Link>;
    })}
  </nav>;
}

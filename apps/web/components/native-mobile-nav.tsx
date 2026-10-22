"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, Home, MoreHorizontal, Printer, ReceiptText, Settings, ShoppingBag, UserRound, Users, X } from "lucide-react";
import { useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { canAccessHref } from "@/lib/role-access";

const primaryItems = [
  { label: "Accueil", href: "/dashboard", icon: Home, exact: true },
  { label: "Caisse", href: "/dashboard/pos", icon: ShoppingBag },
  { label: "Stock", href: "/dashboard/inventory", icon: Boxes }
];

const moreItems = [
  { label: "Ventes et reçus", href: "/dashboard/sales/completed", icon: ReceiptText },
  { label: "Clients", href: "/dashboard/customers", icon: Users },
  { label: "Rapports", href: "/dashboard/reports", icon: BarChart3 },
  { label: "Imprimantes", href: "/dashboard/settings/pos", icon: Printer },
  { label: "Paramètres", href: "/dashboard/settings", icon: Settings },
  { label: "Mon profil", href: "/dashboard/profile", icon: UserRound }
];

export function NativeMobileNav({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const availablePrimary = primaryItems.filter((item) => canAccessHref(user, item.href));
  const availableMore = moreItems.filter((item) => canAccessHref(user, item.href));

  return (
    <>
      {showMore ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:hidden" role="dialog" aria-modal="true" aria-label="Plus d'options">
          <button className="absolute inset-0" type="button" aria-label="Fermer" onClick={() => setShowMore(false)} />
          <section className="relative z-10 w-full rounded-[28px] bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">VTA POS</p>
                <h2 className="text-xl font-black text-[#182858]">Plus</h2>
              </div>
              <button type="button" onClick={() => setShowMore(false)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {availableMore.map((item) => {
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} onClick={() => setShowMore(false)} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 font-bold text-[#182858] shadow-sm"><Icon className="h-5 w-5 text-blue-600" />{item.label}</Link>;
              })}
            </div>
            <p className="mt-4 text-center text-[11px] font-semibold text-slate-400">Une solution de VTA Enterprise</p>
          </section>
        </div>
      ) : null}

      <nav className="vta-native-only vta-native-flex fixed inset-x-0 bottom-0 z-[65] border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur" aria-label="Navigation VTA POS">
        <div className="mx-auto grid h-[70px] w-full max-w-lg items-center" style={{ gridTemplateColumns: `repeat(${availablePrimary.length + 1}, minmax(0, 1fr))` }}>
          {availablePrimary.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold ${active ? "text-blue-600" : "text-slate-500"}`}><Icon className={`h-5 w-5 ${active ? "fill-blue-50" : ""}`} />{item.label}</Link>;
          })}
          <button type="button" onClick={() => setShowMore(true)} className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold ${showMore ? "text-blue-600" : "text-slate-500"}`}><MoreHorizontal className="h-5 w-5" />Plus</button>
        </div>
      </nav>
    </>
  );
}

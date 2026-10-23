"use client";
import Link from "next/link";
import { Users, BarChart3, Printer, UserCircle, RefreshCw, Settings, LogOut } from "lucide-react";
import { logout } from "@/lib/auth";
const items = [
  { href: "/dashboard/customers", label: "Clients", icon: Users },
  { href: "/dashboard/reports", label: "Rapports", icon: BarChart3 },
  { href: "/dashboard/settings/pos", label: "Imprimante et tickets", icon: Printer },
  { href: "/offline", label: "Ventes locales et synchronisation", icon: RefreshCw },
  { href: "/dashboard/profile", label: "Mon profil", icon: UserCircle },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings }
];
export default function MorePage() {
  return <div className="mx-auto max-w-xl"><h1 className="mb-5 text-2xl font-bold tracking-tight">Plus</h1><div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">{items.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className="flex min-h-16 items-center gap-3 border-b border-slate-100 px-4 py-4 text-sm font-semibold last:border-0 dark:border-slate-800"><Icon size={21} className="text-blue-600" />{label}<span className="ml-auto text-slate-400">›</span></Link>)}</div><button onClick={async () => { await logout(); window.location.href = "/"; }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-white p-4 font-semibold text-red-600"><LogOut size={19} />Se déconnecter</button></div>;
}

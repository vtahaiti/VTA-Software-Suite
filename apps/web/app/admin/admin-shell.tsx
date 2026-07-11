"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { platformLogout, verifyPlatformSession } from "@/lib/platform";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/companies", label: "Entreprises" },
  { href: "/admin/subscriptions", label: "Abonnements" },
  { href: "/admin/system", label: "Systeme" }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      const valid = await verifyPlatformSession();
      if (cancelled) return;
      if (!valid) {
        router.replace("/admin/login");
        return;
      }
      setAllowed(true);
    }
    void verify();
    return () => { cancelled = true; };
  }, [router]);

  async function logout() {
    await platformLogout();
    router.replace("/admin/login");
    router.refresh();
  }

  if (!allowed) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Verification de l&apos;acces plateforme...</main>;
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-[#081426] p-6 xl:block">
        <Link href="/admin/dashboard" className="block rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">VTA ERP</p>
          <h1 className="mt-2 text-xl font-black text-white">Cloud Control Center</h1>
          <p className="mt-2 text-xs text-slate-400">Plateforme SaaS globale</p>
        </Link>
        <nav className="mt-8 grid gap-2 text-sm font-semibold">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-4 py-3 text-slate-300 transition hover:bg-white/10 hover:text-white">{item.label}</Link>
          ))}
        </nav>
        <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-400">
          Réservé aux SUPER_ADMIN. Les données affichées dépendent des permissions plateforme.
          <button onClick={logout} className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/10">Déconnexion</button>
        </div>
      </aside>
      <div className="xl:pl-72">
        <header className="border-b border-white/10 bg-[#07111f]/95 px-5 py-5 backdrop-blur lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Centre de controle plateforme</p>
          <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-black text-white">VTA ERP Control Center</h2>
              <p className="mt-1 text-sm text-slate-400">Administration globale des entreprises, abonnements, modules et signaux securite.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/companies" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-400/20">Gérer les entreprises</Link>
              <button onClick={logout} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 xl:hidden">Déconnexion</button>
            </div>
          </div>
        </header>
        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}


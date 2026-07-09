"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../admin-shell";
import { platformFetch } from "@/lib/platform";

type Tenant = {
  id: string;
  logoUrl?: string | null;
  name: string;
  slug: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  currency?: string | null;
  country?: string | null;
  city?: string | null;
  primaryActivity?: string | null;
  version: string;
  plan: string;
  subscriptionStatus: string;
  lastLoginAt?: string | null;
  lastSeenAt?: string | null;
  modules: Array<{ key: string; name: string; category: string }>;
  users: number;
  products: number;
  sales: number;
  invoices: number;
  revenueTotal: number;
  revenueMonth: number;
  profit: number;
  stores: number;
  warehouses: number;
  createdAt: string;
};

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { void loadTenants(); }, []);

  async function loadTenants() {
    try { setTenants(await platformFetch<Tenant[]>("/platform/tenants")); } catch (err) { setError(err instanceof Error ? err.message : "Chargement impossible"); }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant) => [tenant.name, tenant.email, tenant.phone, tenant.country, tenant.city, tenant.primaryActivity].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
  }, [query, tenants]);

  async function updateStatus(id: string, status: string) {
    setError(""); setMessage("");
    try {
      await platformFetch(`/platform/tenants/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMessage("Statut entreprise mis a jour.");
      await loadTenants();
    } catch (err) { setError(err instanceof Error ? err.message : "Action impossible"); }
  }

  async function updatePlan(id: string, plan: string) {
    setError(""); setMessage("");
    try {
      await platformFetch(`/platform/tenants/${id}/subscription`, { method: "PATCH", body: JSON.stringify({ plan, status: "ACTIVE" }) });
      setMessage("Abonnement mis a jour.");
      await loadTenants();
    } catch (err) { setError(err instanceof Error ? err.message : "Abonnement impossible"); }
  }

  async function deleteDemoTenants() {
    if (!window.confirm("Supprimer toutes les entreprises demo/test/QA ? Les PlatformAdmin restent proteges.")) return;
    setError(""); setMessage("");
    try {
      const result = await platformFetch<{ deletedCount: number }>("/platform/tenants/demo", { method: "DELETE" });
      setMessage(`${result.deletedCount} entreprise(s) de test supprimee(s).`);
      await loadTenants();
    } catch (err) { setError(err instanceof Error ? err.message : "Nettoyage impossible"); }
  }

  async function deleteTenant(id: string, name: string) {
    if (!window.confirm(`Supprimer l'entreprise ${name} ? Elle sera desactivee et ses utilisateurs ne pourront plus se connecter.`)) return;
    setError(""); setMessage("");
    try {
      await platformFetch(`/platform/tenants/${id}`, { method: "DELETE" });
      setMessage("Entreprise supprimee proprement.");
      await loadTenants();
    } catch (err) { setError(err instanceof Error ? err.message : "Suppression impossible"); }
  }

  return (
    <AdminShell>
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-black text-white">Entreprises de la plateforme</h2>
          <p className="mt-1 text-sm text-slate-400">Vue administrative globale. Aucune donnee interne client n&apos;est exposee.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher nom, email, telephone, pays, activite..." className="min-w-[320px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" />
          <button onClick={() => void deleteDemoTenants()} className="rounded-xl border border-orange-300/30 bg-orange-400/10 px-4 py-3 text-sm font-bold text-orange-100">Supprimer demos</button>
        </div>
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}
      {message ? <Alert tone="green">{message}</Alert> : null}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/10">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-4">Entreprise</th><th>Activite</th><th>Pays / Ville</th><th>Contact</th><th>Devise</th><th>Creation</th><th>Derniere activite</th><th>Plan</th><th>Statut</th><th>Usage reel</th><th>Chiffre d&apos;affaires</th><th>Actions</th></tr></thead>
          <tbody>{filtered.map((tenant) => <tr key={tenant.id} className="border-t border-white/10 text-slate-300"><td className="p-4"><div className="flex items-center gap-3"><Logo tenant={tenant} /><div><Link href={`/admin/companies/${tenant.id}`} className="font-black text-cyan-100">{tenant.name}</Link><p className="text-xs text-slate-500">{tenant.slug}</p></div></div></td><td>{tenant.primaryActivity ?? "Non defini"}</td><td>{tenant.country ?? "-"}<p className="text-xs text-slate-500">{tenant.city ?? "-"}</p></td><td>{tenant.phone ?? "-"}<p className="text-xs text-slate-500">{tenant.email ?? "-"}</p></td><td>{tenant.currency ?? "HTG"}</td><td>{new Date(tenant.createdAt).toLocaleDateString("fr-HT")}</td><td>{tenant.lastLoginAt ? new Date(tenant.lastLoginAt).toLocaleString("fr-HT") : "Jamais"}<p className="text-xs text-slate-500">{tenant.lastSeenAt ? `Vu ${new Date(tenant.lastSeenAt).toLocaleString("fr-HT")}` : ""}</p></td><td><b className="text-white">{tenant.plan}</b><p className="text-xs text-slate-500">{tenant.subscriptionStatus}</p></td><td><Status value={tenant.status} /></td><td>{tenant.users} users · {tenant.products} produits<p className="text-xs text-slate-500">{tenant.sales} ventes · {tenant.invoices} factures · {tenant.stores} magasins</p></td><td><b className="text-white">{formatMoney(tenant.revenueTotal, tenant.currency ?? "HTG")}</b><p className="text-xs text-slate-500">Mois: {formatMoney(tenant.revenueMonth, tenant.currency ?? "HTG")} · Profit: {formatMoney(tenant.profit, tenant.currency ?? "HTG")}</p></td><td><div className="grid gap-2"><Link href={`/admin/companies/${tenant.id}`} className="font-bold text-cyan-200">Controler</Link><div className="flex flex-wrap gap-1"><button onClick={() => void updateStatus(tenant.id, "ACTIVE")} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/20">Activer</button><button onClick={() => void updateStatus(tenant.id, "PAUSED")} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/20">Pause</button><button onClick={() => void updateStatus(tenant.id, "TRIAL")} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/20">Essai</button><button onClick={() => void updateStatus(tenant.id, "SUSPENDED")} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/20">Suspendre</button><button onClick={() => void deleteTenant(tenant.id, tenant.name)} className="rounded-full bg-red-400/20 px-2 py-1 text-xs font-bold text-red-100 hover:bg-red-400/30">Supprimer</button></div><div className="flex flex-wrap gap-1"><button onClick={() => void updatePlan(tenant.id, "STARTER")} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/20">Starter</button><button onClick={() => void updatePlan(tenant.id, "PRO")} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/20">Pro</button><button onClick={() => void updatePlan(tenant.id, "ENTERPRISE")} className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/20">Enterprise</button></div></div></td></tr>)}</tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Logo({ tenant }: { tenant: Tenant }) {
  if (tenant.logoUrl) return <img src={tenant.logoUrl} alt="Logo" className="h-11 w-11 rounded-xl object-cover" />;
  return <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/20 font-black text-cyan-100">{tenant.name.slice(0, 2).toUpperCase()}</div>;
}

function Status({ value }: { value: string }) {
  const color = value === "ACTIVE" ? "bg-emerald-400/20 text-emerald-200" : value === "TRIAL" ? "bg-yellow-400/20 text-yellow-200" : value === "PAUSED" ? "bg-blue-400/20 text-blue-200" : value === "SUSPENDED" ? "bg-orange-400/20 text-orange-200" : "bg-red-400/20 text-red-200";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${color}`}>{value}</span>;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: currency === "USD" ? "USD" : "HTG", maximumFractionDigits: 0 }).format(value);
}

function Alert({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) {
  return <div className={`mb-4 rounded-xl border p-3 text-sm ${tone === "red" ? "border-red-400/30 bg-red-400/10 text-red-100" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"}`}>{children}</div>;
}



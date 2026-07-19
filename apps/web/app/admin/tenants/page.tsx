"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../admin-shell";
import { getAdminSubscriptionDisplay } from "@/lib/admin-subscription-display";
import { platformFetch } from "@/lib/platform";

type Tenant = {
  id: string;
  logoUrl?: string | null;
  name: string;
  slug: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  primaryActivity?: string | null;
  plan: string;
  subscriptionStatus: string;
  subscriptionEndsAt?: string | null;
  lastLoginAt?: string | null;
  modules: Array<{ key: string; name: string; category: string }>;
  users: number;
  stores: number;
  warehouses: number;
  createdAt: string;
};

const statusOptions = ["Tous", "ACTIVE", "TRIAL", "PAUSED", "SUSPENDED", "EXPIRED"];

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { void loadTenants(); }, []);

  async function loadTenants() {
    try { setTenants(await platformFetch<Tenant[]>("/platform/tenants")); } catch (err) { setError(err instanceof Error ? err.message : "Chargement impossible"); }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesStatus = status === "Tous" || tenant.status === status;
      const matchesSearch = !term || [tenant.name, tenant.slug, tenant.email, tenant.phone, tenant.country, tenant.city, tenant.primaryActivity].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [query, status, tenants]);

  async function updateStatus(id: string, nextStatus: string) {
    const reason = window.prompt("Motif obligatoire pour cette action plateforme :");
    if (!reason || reason.trim().length < 6) {
      setError("Motif obligatoire, au moins 6 caractères.");
      return;
    }
    setError(""); setMessage("");
    try {
      await platformFetch(`/platform/tenants/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus, reason }) });
      setMessage("Statut entreprise mis à jour.");
      await loadTenants();
    } catch (err) { setError(err instanceof Error ? err.message : "Action impossible"); }
  }

  return (
    <AdminShell>
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-black text-white">Entreprises</h2>
          <p className="mt-1 text-sm text-slate-400">Informations administratives, abonnements et accès. Les ventes, produits, stocks, factures et clients privés ne sont pas exposés.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher entreprise, email, téléphone, pays..." className="min-w-[260px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300">
            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}
      {message ? <Alert tone="green">{message}</Alert> : null}
      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/10 xl:block">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white/5 text-xs uppercase tracking-wide text-slate-400">
            <tr><th className="p-4">Entreprise</th><th>Contact</th><th>Pays</th><th>Plan actif</th><th>Statut abonnement</th><th>Échéance</th><th>Licences</th><th>Dernière connexion</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((tenant) => {
              const subscription = getAdminSubscriptionDisplay({ plan: tenant.plan, subscriptionStatus: tenant.subscriptionStatus, status: tenant.status, subscriptionEndsAt: tenant.subscriptionEndsAt });
              return (
                <tr key={tenant.id} className="border-t border-white/10 text-slate-300">
                  <td className="p-4"><div className="flex items-center gap-3"><Logo tenant={tenant} /><div><Link href={`/admin/companies/${tenant.id}`} className="font-black text-cyan-100">{tenant.name}</Link><p className="text-xs text-slate-500">{tenant.slug}</p></div></div></td>
                  <td>{tenant.phone ?? "-"}<p className="text-xs text-slate-500">{tenant.email ?? "-"}</p></td>
                  <td>{tenant.country ?? "-"}<p className="text-xs text-slate-500">{tenant.city ?? "-"}</p></td>
                  <td><b className="text-white">{subscription.planLabel}</b><p className="text-xs text-slate-500">{subscription.paymentLabel}</p></td>
                  <td><SubscriptionStatus value={subscription.statusLabel} /></td>
                  <td>{subscription.dueDateLabel}</td>
                  <td>{tenant.users} utilisateurs<p className="text-xs text-slate-500">{tenant.stores} magasins · {tenant.warehouses} dépôts</p></td>
                  <td>{tenant.lastLoginAt ? new Date(tenant.lastLoginAt).toLocaleString("fr-HT") : "Jamais"}</td>
                  <td><ActionMenu tenant={tenant} onStatus={updateStatus} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 xl:hidden">
        {filtered.map((tenant) => {
          const subscription = getAdminSubscriptionDisplay({ plan: tenant.plan, subscriptionStatus: tenant.subscriptionStatus, status: tenant.status, subscriptionEndsAt: tenant.subscriptionEndsAt });
          return (
            <article key={tenant.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3"><Logo tenant={tenant} /><div className="min-w-0 flex-1"><Link href={`/admin/companies/${tenant.id}`} className="font-black text-cyan-100">{tenant.name}</Link><p className="text-sm text-slate-400">{tenant.country ?? "-"} · {subscription.planLabel}</p><SubscriptionStatus value={subscription.statusLabel} /></div></div>
              <div className="mt-3 grid gap-2 text-sm text-slate-300"><p>Paiement : {subscription.paymentLabel}</p><p>Échéance : {subscription.dueDateLabel}</p><p>{tenant.users} utilisateurs · {tenant.stores} magasins</p><p>{tenant.email ?? "-"} · {tenant.phone ?? "-"}</p><p>Dernière connexion : {tenant.lastLoginAt ? new Date(tenant.lastLoginAt).toLocaleString("fr-HT") : "Jamais"}</p></div>
              <div className="mt-3"><ActionMenu tenant={tenant} onStatus={updateStatus} /></div>
            </article>
          );
        })}
      </div>
    </AdminShell>
  );
}

function ActionMenu({ tenant, onStatus }: { tenant: Tenant; onStatus: (id: string, status: string) => Promise<void> }) {
  return <div className="flex flex-wrap gap-2"><Link href={`/admin/companies/${tenant.id}`} className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-bold text-cyan-100">Voir</Link>{tenant.status !== "ACTIVE" ? <button onClick={() => void onStatus(tenant.id, "ACTIVE")} className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-100">Réactiver</button> : <button onClick={() => void onStatus(tenant.id, "SUSPENDED")} className="rounded-full bg-orange-400/15 px-3 py-1 text-xs font-bold text-orange-100">Suspendre</button>}<Link href={`/admin/companies/${tenant.id}#danger-zone`} className="rounded-full bg-red-400/15 px-3 py-1 text-xs font-bold text-red-100">Zone dangereuse</Link></div>;
}

function Logo({ tenant }: { tenant: Tenant }) {
  if (tenant.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tenant.logoUrl} alt="Logo" className="h-11 w-11 rounded-xl object-cover" />;
  }
  return <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/20 font-black text-cyan-100">{tenant.name.slice(0, 2).toUpperCase()}</div>;
}
function SubscriptionStatus({ value }: { value: string }) { const color = value === "Actif" ? "bg-emerald-400/20 text-emerald-200" : value === "Essai en cours" ? "bg-yellow-400/20 text-yellow-200" : value === "En pause" ? "bg-blue-400/20 text-blue-200" : value === "Suspendu" ? "bg-orange-400/20 text-orange-200" : "bg-red-400/20 text-red-200"; return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${color}`}>{value}</span>; }
function Alert({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) { return <div className={`mb-4 rounded-xl border p-3 text-sm ${tone === "red" ? "border-red-400/30 bg-red-400/10 text-red-100" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"}`}>{children}</div>; }

"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../admin-shell";
import { platformFetch } from "@/lib/platform";

type TenantDetail = {
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
  subscription: { plan: string; status: string; startedAt?: string | null; endsAt?: string | null; monthlyPrice: number; price?: number; currency?: string; paymentStatus?: string; paymentReceived: boolean; paymentPending: boolean; autoRenew: boolean; trial: boolean };
  users: Array<{ id: string; name: string; email: string; roles: string[]; isActive: boolean; createdAt: string }>;
  licenses: { users: number; stores: number; warehouses: number; modulesActive: number; modulesDisabled: number };
  statistics: { users: number; stores: number; warehouses: number; storage: string };
  modules: Array<{ key: string; name: string; category: string; isActive: boolean }>;
  stores: Array<{ id: string; name: string; status: string; createdAt: string }>;
  warehouses: Array<{ id: string; name: string; status: string; isActive: boolean; createdAt: string }>;
  security: Array<{ id: string; event: string; status: string; email?: string | null; ipAddress?: string | null; userAgent?: string | null; createdAt: string }>;
  notes: Array<{ id: string; entity?: string; message: string; createdAt: string }>;
  createdAt: string;
};

export default function AdminTenantDetailPage({ params }: { params: { id: string } }) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [note, setNote] = useState("");
  const [platformMessage, setPlatformMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() { setTenant(await platformFetch<TenantDetail>(`/platform/tenants/${params.id}`)); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, [params.id]);

  async function action(run: () => Promise<unknown>, success: string) {
    setError(""); setMessage("");
    try { await run(); setMessage(success); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Action impossible"); }
  }

  async function setStatus(status: string) {
    const reason = window.prompt("Motif obligatoire pour cette action plateforme :");
    if (!reason || reason.trim().length < 6) { setError("Motif obligatoire, au moins 6 caractères."); return; }
    await action(() => platformFetch(`/platform/tenants/${params.id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) }), "Statut entreprise mis à jour.");
  }

  async function dangerDelete() {
    if (!tenant) return;
    const typed = window.prompt(`Zone dangereuse. Saisissez exactement le nom de l'entreprise pour confirmer : ${tenant.name}`);
    if (typed !== tenant.name) { setError("Confirmation incorrecte. Aucune action effectuée."); return; }
    const reason = window.prompt("Motif obligatoire de suppression :");
    if (!reason || reason.trim().length < 6) { setError("Motif obligatoire, au moins 6 caractères."); return; }
    await action(() => platformFetch(`/platform/tenants/${tenant.id}`, { method: "DELETE", body: JSON.stringify({ reason }) }), "Entreprise désactivée. La purge définitive reste une étape séparée et protégée.");
  }

  if (!tenant) return <AdminShell><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-slate-300">Chargement...</div></AdminShell>;

  return (
    <AdminShell>
      {error ? <Alert tone="red">{error}</Alert> : null}
      {message ? <Alert tone="green">{message}</Alert> : null}
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4"><Logo tenant={tenant} /><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Entreprise cliente</p><h2 className="mt-1 text-3xl font-black text-white">{tenant.name}</h2><p className="mt-1 text-sm text-slate-400">{tenant.primaryActivity ?? "Activité non définie"} · {tenant.country ?? "Pays non défini"} · {tenant.city ?? "Ville non définie"}</p><p className="mt-1 text-xs text-slate-500">{tenant.email ?? "-"} · {tenant.phone ?? "-"}</p></div></div>
          <div className="flex flex-wrap gap-2"><Button onClick={() => void setStatus("ACTIVE")}>Réactiver</Button><Button onClick={() => void setStatus("PAUSED")}>Mettre en pause</Button><Button onClick={() => void setStatus("SUSPENDED")}>Suspendre</Button><Button onClick={() => void setStatus("EXPIRED")}>Marquer expirée</Button></div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Statut" value={tenant.status} />
        <Metric label="Plan" value={tenant.subscription.plan} />
        <Metric label="Utilisateurs" value={tenant.licenses.users} />
        <Metric label="Magasins" value={tenant.licenses.stores} />
        <Metric label="Modules actifs" value={tenant.licenses.modulesActive} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Abonnement" subtitle="Gestion du plan, paiement et expiration.">
          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2"><Info label="Plan actuel" value={tenant.subscription.plan} /><Info label="Prix" value={`${tenant.subscription.price ?? tenant.subscription.monthlyPrice} ${tenant.subscription.currency ?? "HTG"}`} /><Info label="Statut abonnement" value={tenant.subscription.status} /><Info label="Statut paiement" value={tenant.subscription.paymentStatus ?? "UNPAID"} /><Info label="Début" value={tenant.subscription.startedAt ? new Date(tenant.subscription.startedAt).toLocaleDateString("fr-HT") : "-"} /><Info label="Expiration" value={tenant.subscription.endsAt ? new Date(tenant.subscription.endsAt).toLocaleDateString("fr-HT") : "Non définie"} /></div>
          <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => action(() => platformFetch(`/platform/tenants/${tenant.id}/subscription`, { method: "PATCH", body: JSON.stringify({ plan: "STARTER", status: "ACTIVE", reason: "Changement de plan depuis Control Center" }) }), "Plan Starter appliqué.")}>Starter</Button><Button onClick={() => action(() => platformFetch(`/platform/tenants/${tenant.id}/subscription`, { method: "PATCH", body: JSON.stringify({ plan: "PRO", status: "ACTIVE", reason: "Changement de plan depuis Control Center" }) }), "Plan Pro appliqué.")}>Pro</Button><Button onClick={() => action(() => platformFetch(`/platform/tenants/${tenant.id}/subscription`, { method: "PATCH", body: JSON.stringify({ plan: "ENTERPRISE", status: "ACTIVE", reason: "Changement de plan depuis Control Center" }) }), "Plan Enterprise appliqué.")}>Enterprise</Button><Button onClick={() => action(() => platformFetch(`/platform/tenants/${tenant.id}/subscription`, { method: "PATCH", body: JSON.stringify({ status: "PAST_DUE", reason: "Paiement en attente" }) }), "Paiement marqué en attente.")}>Paiement en attente</Button></div>
        </Panel>
        <Panel title="Licences et ressources" subtitle="Aucune donnée métier privée n'est ouverte depuis ce panneau."><div className="grid gap-3 md:grid-cols-2"><Info label="Utilisateurs" value={tenant.licenses.users} /><Info label="Magasins" value={tenant.licenses.stores} /><Info label="Dépôts" value={tenant.licenses.warehouses} /><Info label="Stockage" value={tenant.statistics.storage} /></div></Panel>
      </div>

      <Panel title="Modules autorisés" subtitle="Activation par entreprise sans consulter ses ventes, produits, clients ou stocks." className="mt-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tenant.modules.map((module) => <div key={module.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-3"><div><p className="font-bold text-white">{module.name}</p><p className="text-xs text-slate-500">{module.category}</p></div><button onClick={() => action(() => platformFetch(`/platform/tenants/${tenant.id}/modules/${module.key}`, { method: "PATCH", body: JSON.stringify({ isActive: !module.isActive, reason: "Modification module depuis Control Center" }) }), "Module mis à jour.")} className={`rounded-full px-3 py-1 text-xs font-black ${module.isActive ? "bg-emerald-400/20 text-emerald-200" : "bg-slate-700 text-slate-300"}`}>{module.isActive ? "Actif" : "Inactif"}</button></div>)}</div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Utilisateurs et accès" subtitle="Contacts de support et rôles, sans accès aux données métier."><div className="grid gap-3">{tenant.users.map((user) => <div key={user.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm"><b className="text-white">{user.name}</b><p className="text-slate-400">{user.email}</p><p className="text-xs text-slate-500">{user.roles.join(", ")} · {user.isActive ? "Actif" : "Désactivé"}</p></div>)}</div></Panel>
        <Panel title="Sécurité" subtitle="Événements de connexion et support technique."><div className="grid gap-3">{tenant.security.slice(0, 6).map((event) => <div key={event.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm"><b className="text-white">{event.event}</b><p className="text-slate-400">{event.email ?? "-"} · {event.ipAddress ?? "IP non disponible"}</p><p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString("fr-HT")}</p></div>)}</div></Panel>
      </div>

      <Panel title="Support et notes plateforme" subtitle="Assistance au propriétaire et historique administratif." className="mt-5">
        <textarea value={platformMessage} onChange={(event) => setPlatformMessage(event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white outline-none focus:border-cyan-300" placeholder="Message à envoyer à cette entreprise..." />
        <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => action(async () => { await platformFetch(`/platform/tenants/${tenant.id}/notifications`, { method: "POST", body: JSON.stringify({ title: "Message VTA", message: platformMessage }) }); setPlatformMessage(""); }, "Notification envoyée aux utilisateurs.")}>Envoyer notification</Button><Button onClick={() => action(async () => { await platformFetch(`/platform/tenants/${tenant.id}/email`, { method: "POST", body: JSON.stringify({ title: "Message VTA", subject: "Message plateforme", message: platformMessage }) }); setPlatformMessage(""); }, "Email préparé.")}>Préparer email</Button></div>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white outline-none focus:border-cyan-300" placeholder="Ajouter une note interne plateforme..." />
        <Button onClick={() => action(async () => { await platformFetch(`/platform/tenants/${tenant.id}/notes`, { method: "POST", body: JSON.stringify({ note }) }); setNote(""); }, "Note interne ajoutée.")}>Ajouter une note</Button>
        <div className="mt-4 grid gap-2">{tenant.notes.map((entry) => <div key={entry.id} className="rounded-xl bg-slate-950/40 p-3 text-sm text-slate-300">{entry.message}<p className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString("fr-HT")}</p></div>)}</div>
      </Panel>

      <Panel title="Zone dangereuse" subtitle="Suppression désactivante uniquement. La purge définitive exige une tâche séparée et testée sur un tenant dédié." className="mt-5" id="danger-zone">
        <p className="text-sm text-slate-400">Cette action désactive l'entreprise, bloque ses utilisateurs et conserve les données pour audit. Elle ne purge pas physiquement les données client.</p>
        <button onClick={() => void dangerDelete()} className="mt-4 rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-500/30">Désactiver l'entreprise</button>
      </Panel>
    </AdminShell>
  );
}

function Logo({ tenant }: { tenant: TenantDetail }) { return tenant.logoUrl ? <img src={tenant.logoUrl} alt="Logo" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/20 text-xl font-black text-cyan-100">{tenant.name.slice(0, 2).toUpperCase()}</div>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>; }
function Panel({ title, subtitle, children, className = "", id }: { title: string; subtitle: string; children: React.ReactNode; className?: string; id?: string }) { return <section id={id} className={`rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10 ${className}`}><h3 className="text-lg font-black text-white">{title}</h3><p className="mt-1 text-sm text-slate-400">{subtitle}</p><div className="mt-4">{children}</div></section>; }
function Info({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-white">{value}</p></div>; }
function Button({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="rounded-xl bg-cyan-400/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-400/25">{children}</button>; }
function Alert({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) { return <div className={`mb-4 rounded-xl border p-3 text-sm ${tone === "red" ? "border-red-400/30 bg-red-400/10 text-red-100" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"}`}>{children}</div>; }

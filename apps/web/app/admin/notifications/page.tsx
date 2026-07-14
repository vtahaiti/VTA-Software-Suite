"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "../admin-shell";
import { platformFetch } from "@/lib/platform";

type TenantOption = { id: string; name: string; status: string };
type HistoryItem = { id: string; tenantName?: string | null; message: string; createdAt: string };
type HistoryResponse = { tenants: TenantOption[]; history: HistoryItem[] };

const levels = [
  { value: "info", label: "Information" },
  { value: "success", label: "Succès" },
  { value: "warning", label: "Avertissement" },
  { value: "urgent", label: "Urgent" }
];

export default function AdminNotificationsPage() {
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [recipient, setRecipient] = useState<"tenant" | "tenants" | "all-active">("tenant");
  const [tenantId, setTenantId] = useState("");
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [ownersOnly, setOwnersOnly] = useState(true);
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("info");
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [dedupKey, setDedupKey] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const selectedCount = useMemo(() => {
    if (recipient === "all-active") return tenants.filter((tenant) => tenant.status === "ACTIVE" || tenant.status === "TRIAL").length;
    if (recipient === "tenants") return tenantIds.length;
    return tenantId ? 1 : 0;
  }, [recipient, tenantId, tenantIds, tenants]);

  const load = useCallback(async () => {
    try {
      const payload = await platformFetch<HistoryResponse>("/platform/notifications");
      setTenants(payload.tenants ?? []);
      setHistory(payload.history ?? []);
      setTenantId((current) => current || payload.tenants?.[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleTenant(id: string) {
    setTenantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function send() {
    setStatus("");
    setError("");
    if (!title.trim() || !message.trim()) {
      setError("Titre et message sont obligatoires.");
      return;
    }
    if (link && !link.startsWith("/dashboard")) {
      setError("Le lien doit être un chemin interne commençant par /dashboard.");
      return;
    }
    if (!window.confirm(`Envoyer cette notification à ${selectedCount} entreprise${selectedCount > 1 ? "s" : ""} ?`)) return;
    try {
      const result = await platformFetch<{ tenantCount: number; delivered: number }>("/platform/notifications", {
        method: "POST",
        body: JSON.stringify({
          recipient,
          tenantId: recipient === "tenant" ? tenantId : undefined,
          tenantIds: recipient === "tenants" ? tenantIds : undefined,
          ownersOnly,
          role: role.trim() || undefined,
          title,
          message,
          level,
          link: link.trim() || undefined,
          expiresAt: expiresAt || undefined,
          dedupKey: dedupKey.trim() || undefined
        })
      });
      setStatus(`Notification envoyée : ${result.delivered} utilisateur${result.delivered > 1 ? "s" : ""}, ${result.tenantCount} entreprise${result.tenantCount > 1 ? "s" : ""}.`);
      setTitle("");
      setMessage("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    }
  }

  return (
    <AdminShell>
      <div className="mb-5">
        <h2 className="text-2xl font-black text-white">Notifications</h2>
        <p className="mt-1 text-sm text-slate-400">Envoyer des messages internes aux entreprises sans email de masse.</p>
      </div>
      {status ? <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">{status}</div> : null}
      {error ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-200">Cible
            <select value={recipient} onChange={(event) => setRecipient(event.target.value as "tenant" | "tenants" | "all-active")} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white">
              <option value="tenant">Une entreprise</option>
              <option value="tenants">Plusieurs entreprises</option>
              <option value="all-active">Tous les tenants actifs</option>
            </select>
          </label>
          {recipient === "tenant" ? (
            <label className="block text-sm font-semibold text-slate-200">Entreprise
              <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white">
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
            </label>
          ) : null}
          {recipient === "tenants" ? (
            <div className="max-h-64 overflow-auto rounded-xl border border-white/10 p-3">
              {tenants.map((tenant) => (
                <label key={tenant.id} className="flex items-center gap-2 py-1 text-sm text-slate-300">
                  <input type="checkbox" checked={tenantIds.includes(tenant.id)} onChange={() => toggleTenant(tenant.id)} />
                  {tenant.name}
                </label>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={ownersOnly} onChange={(event) => setOwnersOnly(event.target.checked)} /> Propriétaires uniquement</label>
            <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Rôle précis optionnel" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div className="space-y-3">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message en texte brut" rows={5} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white">
              {levels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="/dashboard/..." className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
            <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
            <input value={dedupKey} onChange={(event) => setDedupKey(event.target.value)} placeholder="Clé anti-doublon optionnelle" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
          </div>
          <button onClick={() => void send()} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950">Envoyer après confirmation</button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h3 className="text-lg font-black text-white">Historique récent</h3>
        <div className="mt-4 grid gap-3">
          {history.length ? history.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
              <p className="font-bold text-white">{item.tenantName ?? "Envoi multi-tenant"}</p>
              <p>{item.message}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("fr-HT")}</p>
            </div>
          )) : <p className="text-sm text-slate-400">Aucun envoi récent.</p>}
        </div>
      </section>
    </AdminShell>
  );
}

"use client";
import { FormEvent, useState } from "react";
import { fetchApi } from "@/lib/api-url";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { getOfflineSales } from "@/lib/offline-db";

export function AccountDeletionForm() {
  const [discardPending, setDiscardPending] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const user = getCurrentUser();
      const sameUser = user?.email.toLowerCase() === email.trim().toLowerCase();
      if (sameUser && !discardPending && (await getOfflineSales()).some(sale => sale.status !== "SYNCED")) {
        setHasPending(true);
        throw new Error("Synchronisez les ventes hors ligne avant de supprimer votre compte.");
      }
      const response = await fetchApi("/profile/delete-account", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), currentPassword: password, confirmation })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(Array.isArray(body.message) ? body.message[0] : body.message || "Suppression impossible.");
      }
      if (sameUser && user) {
        indexedDB.deleteDatabase(`vta-commerce-offline:${user.tenantId}:${user.id}`);
        clearSession();
      }
      setPassword(""); setDone(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Suppression impossible. Réessayez avec Internet."); }
    finally { setBusy(false); }
  }
  if (done) return <p role="status" className="mt-8 rounded-lg bg-emerald-50 p-5 text-emerald-900">Votre compte est supprimé et vos sessions sont révoquées.</p>;
  return <form onSubmit={submit} className="mt-8 grid gap-4 rounded-lg border border-red-200 p-5">
    <h2 className="text-lg font-semibold">Supprimer définitivement mon compte</h2>
    <p className="text-sm">Disponible même si votre abonnement est expiré. Votre identité et vos accès seront supprimés immédiatement. Les documents partagés de l’entreprise restent conservés avec une identité anonymisée. Cette action est irréversible.</p>
    <p className="text-sm">Synchronisez vos ventes sur tous vos appareils et transmettez les accès de gestion à un autre responsable avant de continuer.</p>
    <label className="grid gap-1">Email du compte<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="rounded border p-2 dark:bg-slate-950" /></label>
    <label className="grid gap-1">Mot de passe actuel<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="rounded border p-2 dark:bg-slate-950" /></label>
    <label className="grid gap-1">Tapez SUPPRIMER<input required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="rounded border p-2 dark:bg-slate-950" /></label>
    {hasPending && <label className="flex gap-2 text-sm text-red-700"><input type="checkbox" checked={discardPending} onChange={e => setDiscardPending(e.target.checked)} />Je comprends que les ventes locales non synchronisées seront définitivement perdues avec ce compte.</label>}
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    <button disabled={busy || !password || confirmation !== "SUPPRIMER"} className="rounded bg-red-700 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Suppression…" : "Supprimer définitivement mon compte"}</button>
  </form>;
}

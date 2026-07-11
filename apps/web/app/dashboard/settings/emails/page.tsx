"use client";

import { FormEvent, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

type EmailStatus = {
  provider: "resend" | "smtp" | "none";
  configured: boolean;
  resendConfigured: boolean;
  smtpConfigured: boolean;
  from: string;
  replyTo: string;
  publicUrl: string;
  webhookConfigured: boolean;
  recentFailures: Array<{ id: string; type: string; provider: string; status: string; errorCode?: string | null; createdAt: string }>;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function EmailSettingsPage() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const token = getAccessToken();
      const response = await fetch(`${apiUrl}/email/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Impossible de charger la configuration email.");
      setStatus(await response.json());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSending(true);
    try {
      const token = getAccessToken();
      const response = await fetch(`${apiUrl}/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: to || undefined })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Impossible d'envoyer l'email de test.");
      setMessage(body.accepted ? "Email de test accepté par le fournisseur." : `Email non accepté : ${body.status}`);
      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur pendant l'envoi du test.");
    } finally {
      setSending(false);
    }
  }

  return <main className="space-y-6">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Paramètres</p>
      <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Emails</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Configuration des emails transactionnels : réinitialisation du mot de passe, invitations, sécurité et reçus.</p>
    </div>

    {loading ? <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950">Chargement...</div> : null}
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

    {status ? <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">État général</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Fournisseur" value={providerLabel(status.provider)} />
          <Row label="Statut" value={status.configured ? "Configuré" : "Configuration absente"} tone={status.configured ? "ok" : "warn"} />
          <Row label="Adresse d'envoi" value={status.from} />
          <Row label="Adresse de réponse" value={status.replyTo} />
          <Row label="URL publique" value={status.publicUrl} />
          <Row label="Webhook Resend" value={status.webhookConfigured ? "Configuré" : "Non configuré"} tone={status.webhookConfigured ? "ok" : "warn"} />
        </dl>
      </div>

      <form onSubmit={sendTest} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Envoyer un email de test</h2>
        <p className="mt-2 text-sm text-slate-500">Laissez vide pour l'envoyer à votre adresse connectée.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="test-email">Destinataire</label>
        <input id="test-email" type="email" value={to} onChange={(event) => setTo(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="exemple@domaine.com" />
        <button disabled={sending || !status.configured} className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{sending ? "Envoi..." : "Envoyer un test"}</button>
        {message ? <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}
      </form>
    </section> : null}

    {status ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Derniers échecs</h2>
      {status.recentFailures.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="py-2">Type</th><th>Fournisseur</th><th>Statut</th><th>Code</th><th>Date</th></tr></thead><tbody>{status.recentFailures.map((item) => <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="py-2">{item.type}</td><td>{providerLabel(item.provider)}</td><td>{item.status}</td><td>{item.errorCode ?? "-"}</td><td>{new Date(item.createdAt).toLocaleString("fr-FR")}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">Aucun échec récent.</p>}
    </section> : null}
  </main>;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className={tone === "ok" ? "font-semibold text-green-700" : tone === "warn" ? "font-semibold text-amber-700" : "font-medium text-slate-900 dark:text-slate-100"}>{value}</dd></div>;
}

function providerLabel(value: string) {
  if (value === "resend") return "Resend";
  if (value === "smtp") return "SMTP";
  return "Aucun";
}
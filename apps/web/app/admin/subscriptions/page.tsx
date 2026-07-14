"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../admin-shell";
import { platformFetch } from "@/lib/platform";

type PendingRequest = {
  id: string;
  status: "PENDING";
  requestedPlanCode?: string;
  requestedPlanName?: string;
  currentPlanCode?: string;
  createdAt?: string;
};

type Row = {
  id: string;
  name: string;
  activity?: string | null;
  status: string;
  subscription: {
    plan: string;
    planCode?: string;
    status: string;
    startedAt?: string | null;
    endsAt?: string | null;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
    monthlyPrice: number;
    price?: number;
    currency?: string;
    paymentReceived: boolean;
    paymentPending: boolean;
    trial: boolean;
    pendingRequest?: PendingRequest | null;
  };
};

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await platformFetch<Row[]>("/platform/subscriptions"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function approve(request: PendingRequest) {
    if (!window.confirm(`Approuver le plan ${request.requestedPlanName || labelPlan(request.requestedPlanCode)} ?`)) return;
    setMessage("");
    setError("");
    try {
      await platformFetch(`/platform/subscription-requests/${request.id}/approve`, { method: "POST" });
      setMessage("Demande approuvée. Le plan est maintenant actif pour l’entreprise.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approbation impossible.");
    }
  }

  async function reject(request: PendingRequest) {
    const reason = window.prompt("Motif du refus");
    if (!reason?.trim()) {
      setError("Un motif est obligatoire pour refuser une demande.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await platformFetch(`/platform/subscription-requests/${request.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason })
      });
      setMessage("Demande refusée. Le plan actuel est conservé.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refus impossible.");
    }
  }

  return (
    <AdminShell>
      <div className="mb-5">
        <h2 className="text-2xl font-black text-white">Abonnements</h2>
        <p className="mt-1 text-sm text-slate-400">Demandes de plan, validations Super Admin et statuts d’abonnement.</p>
      </div>

      {message ? <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div> : null}
      {error ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="p-4">Entreprise</th>
              <th>Activité</th>
              <th>Plan actif</th>
              <th>Statut</th>
              <th>Expiration</th>
              <th>Mensuel</th>
              <th>Demande</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="p-4 text-slate-400" colSpan={8}>Chargement...</td></tr> : null}
            {!loading && rows.map((row) => {
              const request = row.subscription.pendingRequest;
              return (
                <tr key={row.id} className="border-t border-white/10 text-slate-300">
                  <td className="p-4"><Link href={`/admin/tenants/${row.id}`} className="font-black text-cyan-100">{row.name}</Link></td>
                  <td>{row.activity ?? "-"}</td>
                  <td>{labelPlan(row.subscription.planCode ?? row.subscription.plan)}</td>
                  <td>{labelStatus(row.subscription.status)}</td>
                  <td>{formatDate(row.subscription.currentPeriodEnd ?? row.subscription.trialEndsAt ?? row.subscription.endsAt)}</td>
                  <td>{formatMoney(row.subscription.price ?? row.subscription.monthlyPrice, row.subscription.currency ?? "HTG")}</td>
                  <td>
                    {request ? (
                      <div>
                        <p className="font-bold text-amber-100">En attente</p>
                        <p className="text-xs text-slate-400">{labelPlan(request.currentPlanCode)} vers {request.requestedPlanName || labelPlan(request.requestedPlanCode)}</p>
                        <p className="text-xs text-slate-500">{formatDate(request.createdAt)}</p>
                      </div>
                    ) : row.subscription.paymentPending ? "Paiement en attente" : row.subscription.trial ? "Essai gratuit" : row.subscription.paymentReceived ? "Paiement reçu" : "À vérifier"}
                  </td>
                  <td>
                    {request ? (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void approve(request)} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950">Approuver</button>
                        <button onClick={() => void reject(request)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">Refuser</button>
                      </div>
                    ) : <span className="text-xs text-slate-500">Aucune demande</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function formatMoney(value: number, currency = "HTG") {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("fr-HT") : "-";
}

function labelPlan(code?: string) {
  const labels: Record<string, string> = { TRIAL: "Essai gratuit", FREE: "Essai gratuit", ESSENTIAL: "Essentiel", STARTER: "Essentiel", STANDARD: "Standard", PRO: "Standard", EXPERT: "Expert", ENTERPRISE: "Expert" };
  return labels[code ?? ""] ?? code ?? "-";
}

function labelStatus(status: string) {
  const labels: Record<string, string> = { TRIALING: "Essai en cours", ACTIVE: "Actif", PAST_DUE: "Paiement en retard", GRACE_PERIOD: "Période de grâce", SUSPENDED: "Suspendu", CANCELED: "Annulé", CANCELLED: "Annulé", EXPIRED: "Expiré" };
  return labels[status] ?? status;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../admin-shell";
import { platformFetch } from "@/lib/platform";

type Row = { id: string; name: string; activity?: string | null; status: string; subscription: { plan: string; planCode?: string; status: string; startedAt?: string | null; endsAt?: string | null; currentPeriodEnd?: string | null; trialEndsAt?: string | null; monthlyPrice: number; price?: number; currency?: string; paymentReceived: boolean; paymentPending: boolean; autoRenew: boolean; trial: boolean }; createdAt: string };

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { platformFetch<Row[]>("/platform/subscriptions").then(setRows).catch((err) => setError(err.message)); }, []);
  return <AdminShell><div className="mb-5"><h2 className="text-2xl font-black text-white">Abonnements</h2><p className="mt-1 text-sm text-slate-400">Plans, paiements, essais gratuits et expirations.</p></div>{error ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}<div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-4">Entreprise</th><th>Activité</th><th>Plan</th><th>Statut</th><th>Début</th><th>Expiration</th><th>Mensuel</th><th>État</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-white/10 text-slate-300"><td className="p-4"><Link href={`/admin/tenants/${row.id}`} className="font-black text-cyan-100">{row.name}</Link></td><td>{row.activity ?? "-"}</td><td>{labelPlan(row.subscription.planCode ?? row.subscription.plan)}</td><td>{labelStatus(row.subscription.status)}</td><td>{formatDate(row.subscription.startedAt)}</td><td>{formatDate(row.subscription.currentPeriodEnd ?? row.subscription.trialEndsAt ?? row.subscription.endsAt)}</td><td>{formatMoney(row.subscription.price ?? row.subscription.monthlyPrice, row.subscription.currency ?? "HTG")}</td><td>{row.subscription.paymentPending ? "Paiement en attente" : row.subscription.trial ? "Essai gratuit" : row.subscription.paymentReceived ? "Paiement reçu" : "À vérifier"}</td></tr>)}</tbody></table></div></AdminShell>;
}
function formatMoney(value: number, currency = "HTG") { return new Intl.NumberFormat("fr-HT", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("fr-HT") : "-"; }
function labelPlan(code?: string) {
  const labels: Record<string, string> = { TRIAL: "Essai gratuit", FREE: "Essai gratuit", ESSENTIAL: "Essentiel", STARTER: "Essentiel", STANDARD: "Standard", PRO: "Standard", EXPERT: "Expert", ENTERPRISE: "Expert" };
  return labels[code ?? ""] ?? code ?? "-";
}
function labelStatus(status: string) {
  const labels: Record<string, string> = { TRIALING: "Essai en cours", ACTIVE: "Actif", PAST_DUE: "Paiement en retard", GRACE_PERIOD: "Période de grâce", SUSPENDED: "Suspendu", CANCELED: "Annulé", CANCELLED: "Annulé", EXPIRED: "Expiré" };
  return labels[status] ?? status;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../admin-shell";
import { platformFetch } from "@/lib/platform";

type Row = { id: string; name: string; activity?: string | null; status: string; subscription: { plan: string; status: string; startedAt?: string | null; endsAt?: string | null; monthlyPrice: number; paymentReceived: boolean; paymentPending: boolean; autoRenew: boolean; trial: boolean }; createdAt: string };

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { platformFetch<Row[]>("/platform/subscriptions").then(setRows).catch((err) => setError(err.message)); }, []);
  return <AdminShell><div className="mb-5"><h2 className="text-2xl font-black text-white">Abonnements</h2><p className="mt-1 text-sm text-slate-400">Plans, paiements, essais gratuits et expirations.</p></div>{error ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}<div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-4">Entreprise</th><th>Activite</th><th>Plan</th><th>Statut paiement</th><th>Debut</th><th>Expiration</th><th>Mensuel</th><th>Etat</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-white/10 text-slate-300"><td className="p-4"><Link href={`/admin/tenants/${row.id}`} className="font-black text-cyan-100">{row.name}</Link></td><td>{row.activity ?? "-"}</td><td>{row.subscription.plan}</td><td>{row.subscription.status}</td><td>{row.subscription.startedAt ? new Date(row.subscription.startedAt).toLocaleDateString("fr-HT") : "-"}</td><td>{row.subscription.endsAt ? new Date(row.subscription.endsAt).toLocaleDateString("fr-HT") : "-"}</td><td>{formatMoney(row.subscription.monthlyPrice)}</td><td>{row.subscription.paymentPending ? "Paiement en attente" : row.subscription.trial ? "Essai gratuit" : row.subscription.paymentReceived ? "Paiement recu" : "A verifier"}</td></tr>)}</tbody></table></div></AdminShell>;
}
function formatMoney(value: number) { return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

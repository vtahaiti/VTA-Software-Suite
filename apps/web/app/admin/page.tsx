"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "./admin-shell";
import { getAdminSubscriptionDisplay } from "@/lib/admin-subscription-display";
import { platformFetch } from "@/lib/platform";

type MoneyByCurrency = { currency: string; amount: number };
type Point = { label: string; value: number };
type Stats = {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  pausedTenants: number;
  expiredTenants: number;
  deletedTenants: number;
  monthlyRevenue: MoneyByCurrency[];
  newTenantsToday: number;
  newSubscriptions: number;
  cancellations: number;
  totalUsers: number;
  connectedUsers: number;
  countries: number;
  storage: { measured: boolean; label: string };
  alerts: { expiredPayments: number; renewalsDue: number; inactiveTenants: number; criticalErrors: number };
  charts: { tenantsCreated: Point[]; revenue: Point[]; subscriptions: Point[]; logins: Point[]; activities: Point[] };
  latestTenants: Array<{ id: string; name: string; status: string; primaryActivity?: string | null; country?: string | null; plan: string; subscriptionStatus: string; subscriptionEndsAt?: string | null; createdAt: string }>;
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    platformFetch<Stats>("/platform/stats").then(setStats).catch((err) => setError(err.message));
  }, []);

  const metrics = useMemo(() => [
    { label: "Entreprises totales", value: stats?.totalTenants ?? 0, tone: "cyan" },
    { label: "Actives", value: stats?.activeTenants ?? 0, tone: "green" },
    { label: "En essai", value: stats?.trialTenants ?? 0, tone: "yellow" },
    { label: "En pause", value: stats?.pausedTenants ?? 0, tone: "blue" },
    { label: "Suspendues", value: stats?.suspendedTenants ?? 0, tone: "orange" },
    { label: "Expirées", value: stats?.expiredTenants ?? 0, tone: "red" },
    { label: "Nouvelles aujourd'hui", value: stats?.newTenantsToday ?? 0, tone: "cyan" },
    { label: "Nouveaux abonnements", value: stats?.newSubscriptions ?? 0, tone: "green" },
    { label: "Annulations", value: stats?.cancellations ?? 0, tone: "red" },
    { label: "Utilisateurs actifs", value: stats?.totalUsers ?? 0, tone: "blue" },
    { label: "Pays", value: stats?.countries ?? 0, tone: "violet" },
    { label: "Stockage", value: stats?.storage.label ?? "Non mesuré", tone: "slate" }
  ], [stats]);

  return (
    <AdminShell>
      {error ? <Alert>{error}</Alert> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <Metric key={metric.label} {...metric} />)}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Revenus VTA Commerce" subtitle="Abonnements payés à la plateforme, séparés par devise. Aucun chiffre d'affaires client n'est agrégé ici.">
          <div className="grid gap-3 md:grid-cols-2">
            {(stats?.monthlyRevenue?.length ? stats.monthlyRevenue : [{ currency: "HTG", amount: 0 }]).map((item) => (
              <div key={item.currency} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.currency}</p>
                <p className="mt-2 text-2xl font-black text-white">{formatMoney(item.amount, item.currency)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MiniChart title="Entreprises créées" points={stats?.charts.tenantsCreated ?? []} />
            <MiniChart title="Abonnements" points={stats?.charts.subscriptions ?? []} />
          </div>
        </Panel>
        <Panel title="Alertes plateforme" subtitle="Renouvellements, incidents et comptes nécessitant une action.">
          <div className="grid gap-3">
            <AlertLine label="Paiements expirés" value={stats?.alerts.expiredPayments ?? 0} />
            <AlertLine label="Abonnements à renouveler" value={stats?.alerts.renewalsDue ?? 0} />
            <AlertLine label="Entreprises inactives" value={stats?.alerts.inactiveTenants ?? 0} />
            <AlertLine label="Erreurs serveur / sécurité" value={stats?.alerts.criticalErrors ?? 0} />
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Activités déclarées" subtitle="Répartition des profils métier, sans consulter les données commerciales internes.">
          <div className="grid gap-3">
            {(stats?.charts.activities ?? []).map((point) => <Bar key={point.label} label={point.label} value={point.value} max={stats?.totalTenants || 1} />)}
          </div>
        </Panel>
        <Panel title="Dernières entreprises inscrites" subtitle="Informations administratives uniquement.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Entreprise</th><th>Activité</th><th>Plan</th><th>Statut abonnement</th><th>Paiement</th><th>Date</th></tr></thead>
              <tbody>{stats?.latestTenants.map((tenant) => {
                const subscription = getAdminSubscriptionDisplay({ plan: tenant.plan, subscriptionStatus: tenant.subscriptionStatus, status: tenant.status, subscriptionEndsAt: tenant.subscriptionEndsAt });
                return <tr key={tenant.id} className="border-t border-white/10"><td className="py-3"><Link href={`/admin/tenants/${tenant.id}`} className="font-bold text-cyan-200">{tenant.name}</Link><p className="text-xs text-slate-500">{tenant.country ?? "Pays non défini"}</p></td><td>{tenant.primaryActivity ?? "-"}</td><td>{subscription.planLabel}</td><td><Status value={subscription.statusLabel} /></td><td>{subscription.paymentLabel}</td><td>{new Date(tenant.createdAt).toLocaleDateString("fr-HT")}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </Panel>
      </section>
    </AdminShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  const colors: Record<string, string> = { cyan: "from-cyan-400/20 to-cyan-400/5 text-cyan-200", green: "from-emerald-400/20 to-emerald-400/5 text-emerald-200", yellow: "from-yellow-400/20 to-yellow-400/5 text-yellow-200", orange: "from-orange-400/20 to-orange-400/5 text-orange-200", red: "from-red-400/20 to-red-400/5 text-red-200", blue: "from-blue-400/20 to-blue-400/5 text-blue-200", violet: "from-violet-400/20 to-violet-400/5 text-violet-200", slate: "from-slate-300/20 to-slate-300/5 text-slate-200" };
  return <div className={`rounded-2xl border border-white/10 bg-gradient-to-br p-4 shadow-xl shadow-black/10 ${colors[tone] ?? colors.slate}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-3 text-2xl font-black text-white">{value}</p></div>;
}
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10"><h3 className="text-lg font-black text-white">{title}</h3><p className="mt-1 text-sm text-slate-400">{subtitle}</p><div className="mt-5">{children}</div></section>; }
function MiniChart({ title, points }: { title: string; points: Point[] }) { const max = Math.max(...points.map((point) => point.value), 1); return <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4"><p className="text-sm font-bold text-white">{title}</p><div className="mt-4 flex h-28 items-end gap-2">{points.map((point) => <div key={point.label} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-cyan-400/70" style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }} /><span className="text-[10px] text-slate-500">{point.label}</span></div>)}</div></div>; }
function AlertLine({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"><span className="text-sm text-slate-300">{label}</span><span className={`rounded-full px-3 py-1 text-sm font-black ${value ? "bg-red-400/20 text-red-200" : "bg-emerald-400/20 text-emerald-200"}`}>{value}</span></div>; }
function Bar({ label, value, max }: { label: string; value: number; max: number }) { return <div><div className="flex justify-between text-sm"><span className="text-slate-300">{label}</span><b className="text-white">{value}</b></div><div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div></div>; }
function Status({ value }: { value: string }) { return <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-200">{value}</span>; }
function Alert({ children }: { children: React.ReactNode }) { return <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{children}</div>; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("fr-HT", { style: "currency", currency: currency === "USD" ? "USD" : "HTG", maximumFractionDigits: 0 }).format(value); }

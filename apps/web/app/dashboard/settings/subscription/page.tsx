"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const tabs = [
  ["Entreprise", "/dashboard/settings/company"],
  ["POS", "/dashboard/settings/pos"],
  ["Facturation", "/dashboard/settings/invoicing"],
  ["Abonnement", "/dashboard/settings/subscription"],
  ["Emails", "/dashboard/settings/emails"]
];

type Plan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  monthlyPrice: number;
  currency: string;
  trialDays: number;
  features: Array<{ key: string; name: string; category: string; enabled: boolean; limit?: number | null }>;
};

type SubscriptionPayload = {
  subscription: {
    plan: string;
    planCode: string;
    status: string;
    price: number;
    currency: string;
    trialStartedAt?: string | null;
    trialEndsAt?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    daysRemaining?: number | null;
    payments: Array<{ id: string; amount: number; currency: string; status: string; provider?: string | null; periodStart: string; periodEnd: string; paidAt?: string | null; createdAt: string }>;
  };
  entitlements: {
    planCode: string;
    status: string;
    active: boolean;
    features: string[];
    featureDetails: Array<{ key: string; name: string; category: string; enabled: boolean; limit?: number | null }>;
  };
};

export default function SubscriptionSettingsPage() {
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [subscriptionResponse, plansResponse] = await Promise.all([
        fetchWithAuth(`${apiUrl}/subscription/me`),
        fetchWithAuth(`${apiUrl}/subscription/plans`)
      ]);
      if (!subscriptionResponse.ok) throw new Error(await readError(subscriptionResponse));
      if (!plansResponse.ok) throw new Error(await readError(plansResponse));
      setData(await subscriptionResponse.json());
      setPlans(await plansResponse.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger l'abonnement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const currentPlan = useMemo(() => plans.find((plan) => plan.code === data?.subscription.planCode), [plans, data?.subscription.planCode]);

  return (
    <div className="space-y-5">
      <Header active="Abonnement" />

      {loading ? <LoadingState /> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}<button onClick={() => void load()} className="ml-3 rounded-md border px-3 py-1 font-semibold">Réessayer</button></div> : null}

      {!loading && data ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-brand-600">Plan actuel</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold">{currentPlan?.name ?? labelPlan(data.subscription.planCode)}</h2>
                  <p className="mt-1 text-sm text-slate-500">{currentPlan?.description ?? "Abonnement VTA Commerce"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-right dark:bg-slate-950">
                  <p className="text-2xl font-bold">{formatMoney(data.subscription.price, data.subscription.currency)}</p>
                  <p className="text-xs text-slate-500">par mois</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Info label="Statut" value={labelStatus(data.subscription.status)} />
                <Info label="Jours restants" value={typeof data.subscription.daysRemaining === "number" ? data.subscription.daysRemaining : "Non défini"} />
                <Info label="Prochain renouvellement" value={formatDate(data.subscription.currentPeriodEnd ?? data.subscription.trialEndsAt)} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Changer de plan</button>
                <button className="rounded-md border px-4 py-2 text-sm font-semibold">Renouveler</button>
                <button className="rounded-md border px-4 py-2 text-sm font-semibold opacity-60" title="Disponible après paiement validé">Télécharger le reçu</button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Le paiement automatique n'est pas activé. Les renouvellements restent validés par VTA Commerce ou par le futur fournisseur de paiement configuré.</p>
            </div>

            <div className="rounded-lg border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-brand-600">Accès effectif</p>
              <h3 className="mt-1 text-xl font-bold">{data.entitlements.active ? "Abonnement actif" : "Abonnement inactif"}</h3>
              <p className="mt-2 text-sm text-slate-500">L'accès combine votre rôle utilisateur, les fonctionnalités du plan et le statut de l'abonnement.</p>
              <div className="mt-4 rounded-lg border bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="font-semibold">{data.entitlements.features.length} fonctionnalités autorisées</p>
                <p className="text-slate-500">Plan {labelPlan(data.entitlements.planCode)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-600">Fonctionnalités incluses</p>
                <h2 className="text-2xl font-bold">Ce que votre plan permet</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.entitlements.featureDetails.map((feature) => (
                <div key={feature.key} className="rounded-lg border p-3 dark:border-slate-800">
                  <p className="font-semibold">{feature.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{feature.category}</p>
                  {feature.limit ? <p className="mt-2 text-xs text-slate-500">Limite: {feature.limit}</p> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-brand-600">Historique des paiements</p>
            {data.subscription.payments.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2">Période</th><th>Montant</th><th>Statut</th><th>Fournisseur</th><th>Payé le</th></tr></thead>
                  <tbody>{data.subscription.payments.map((payment) => <tr key={payment.id} className="border-t dark:border-slate-800"><td className="py-3">{formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}</td><td>{formatMoney(payment.amount, payment.currency)}</td><td>{payment.status}</td><td>{payment.provider ?? "Manuel"}</td><td>{formatDate(payment.paidAt)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950">Aucun paiement enregistré pour cet abonnement.</p>}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Header({ active }: { active: string }) {
  return (
    <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Paramètres</p>
      <h1 className="text-2xl font-bold">Abonnement</h1>
      <div className="mt-4 flex flex-wrap gap-2">{tabs.map(([label, href]) => <Link key={href} href={href} className={`rounded-md px-3 py-2 text-sm ${label === active ? "bg-brand-600 text-white" : "border"}`}>{label}</Link>)}</div>
    </div>
  );
}

function LoadingState() {
  return <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-lg border bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />)}</div>;
}

function Info({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function formatMoney(value: number, currency = "HTG") {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("fr-HT", { timeZone: "America/Port-au-Prince" }) : "Non défini";
}

function labelPlan(code?: string) {
  const labels: Record<string, string> = { TRIAL: "Essai gratuit", FREE: "Essai gratuit", ESSENTIAL: "Essentiel", STARTER: "Essentiel", STANDARD: "Standard", PRO: "Standard", EXPERT: "Expert", ENTERPRISE: "Expert" };
  return labels[code ?? ""] ?? code ?? "Non défini";
}

function labelStatus(status: string) {
  const labels: Record<string, string> = { TRIALING: "Essai en cours", ACTIVE: "Actif", PAST_DUE: "Paiement en retard", GRACE_PERIOD: "Période de grâce", SUSPENDED: "Suspendu", CANCELED: "Annulé", CANCELLED: "Annulé", EXPIRED: "Expiré" };
  return labels[status] ?? status;
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Requête impossible.";
  } catch {
    return "Requête impossible.";
  }
}

"use client";

import { useEffect, useState } from "react";
import { clearSession, getAccessToken, getCurrentUser, refreshSession } from "@/lib/auth";
import { getReceiptPrintSettings, openPrintPreview } from "@/lib/print";
import { summarizePayments } from "@/lib/payment-summary";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Sale = {
  id: string;
  status: string;
  total: string | number;
  createdAt: string;
  customer?: { displayName?: string | null; phone?: string | null } | null;
  receipt?: { number: string } | null;
  payments?: Array<{ amount: string | number; receivedAmount?: string | number | null; changeAmount?: string | number | null }>;
};
type Draft = {
  storageKey: string;
  cart?: { total: number; items: Array<{ name: string; quantity: number; total?: number }> };
  customerId?: string;
  payments?: Array<{ amount: string }>;
  updatedAt?: string;
};

export function SalesStatusPage({ type }: { type: "in-progress" | "completed" | "cancelled" }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, [type]);

  async function load() {
    setMessage("");
    if (type === "in-progress") {
      setDrafts(loadDrafts());
      return;
    }
    const status = type === "cancelled" ? "CANCELLED" : "COMPLETED";
    const params = new URLSearchParams({ status, limit: "50" });
    if (type === "completed") params.set("excludeTestData", "true");
    let token = getAccessToken();
        let response = await fetch(`${apiUrl}/sales?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
        if (response?.status === 401 || response?.status === 403) {
          const refreshedUser = await refreshSession();
          token = refreshedUser ? getAccessToken() : null;
          if (!token) {
            clearSession();
            window.location.href = "/login";
            return;
          }
          response = await fetch(`${apiUrl}/sales?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
        }
        if (!response?.ok) {
          setMessage("Impossible de charger les ventes.");
          return;
        }
    const data = await response.json();
    const items = uniqueSales(data.items ?? []);
    setSales(type === "completed" ? items.filter(isPaidCompletedSale) : items);
  }

  const title = type === "in-progress" ? "Ventes en cours" : type === "completed" ? "Ventes terminées" : "Ventes annulées";
  const subtitle = type === "in-progress" ? "Brouillons POS, commandes en attente et paiements partiels." : type === "completed" ? "Ventes payées ou clôturées." : "Historique des ventes annulées.";

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Ventes</p>
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </section>
    {message ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
    {type === "in-progress" ? <DraftList drafts={drafts} /> : <SaleList sales={sales} type={type} />}
  </div>;
}

function DraftList({ drafts }: { drafts: Draft[] }) {
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);

  function continueDraft() {
    window.location.href = "/dashboard/pos";
  }

  function cancelDraft(storageKey: string) {
    if (!window.confirm("Annuler cette vente en cours ?")) return;
    window.localStorage.removeItem(storageKey);
    window.location.reload();
  }

  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h2 className="font-bold">Brouillons POS</h2>
    <div className="mt-4 grid gap-3">
      {drafts.length ? drafts.map((draft, index) => <div key={`${draft.updatedAt}-${index}`} className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="font-semibold">Vente en cours</p>
            <p className="text-sm text-slate-500">{draft.cart?.items.length ?? 0} article(s) - Mise à jour {draft.updatedAt ? new Date(draft.updatedAt).toLocaleString("fr-HT") : "-"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-2 text-xl font-bold text-brand-600">{formatMoney(draft.cart?.total ?? 0)}</p>
            <button onClick={continueDraft} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Continuer</button>
            <button onClick={() => setSelectedDraft(draft)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Voir détail</button>
            <button onClick={() => cancelDraft(draft.storageKey)} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 dark:border-red-900">Annuler</button>
          </div>
        </div>
      </div>) : <p className="text-sm text-slate-500">Aucune vente en cours.</p>}
    </div>
    {selectedDraft ? (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Détail de la vente en cours</h3>
              <p className="text-sm text-slate-500">Cette vente sera restaurée dans le POS avec le panier, le client et les paiements.</p>
            </div>
            <button onClick={() => setSelectedDraft(null)} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
          </div>
          <div className="mt-4 space-y-3">
            {(selectedDraft.cart?.items ?? []).map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex justify-between rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                <span>{item.name} x{item.quantity}</span>
                <b>{formatMoney(item.total ?? 0)}</b>
              </div>
            ))}
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatMoney(selectedDraft.cart?.total ?? 0)}</span></div>
            <button onClick={continueDraft} className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">Continuer dans le POS</button>
          </div>
        </div>
      </div>
    ) : null}
  </section>;
}

function SaleList({ sales, type }: { sales: Sale[]; type: "completed" | "cancelled" }) {
  async function printSale(saleId: string) {
    try {
      const settings = await getReceiptPrintSettings();
      await openPrintPreview(`/sales/${saleId}/receipt`, { width: settings.width });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Impossible d'ouvrir l'aperçu du ticket.");
    }
  }

  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <table className="w-full min-w-[920px] text-left text-sm">
      <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Date</th><th className="p-3">Client</th><th className="p-3">Statut</th><th className="p-3">Total</th><th className="p-3">Montant réglé</th><th className="p-3">Montant reçu</th><th className="p-3">Monnaie</th><th className="p-3">Actions</th></tr></thead>
      <tbody>{sales.map((sale) => {
        const paymentSummary = summarizePayments(sale.total, sale.payments ?? []);
        const paid = paymentSummary.settledAmount;
        const received = paymentSummary.receivedAmount;
        const change = paymentSummary.changeAmount;
        const total = paymentSummary.total;
        return <tr key={sale.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3">{new Date(sale.createdAt).toLocaleString("fr-HT")}</td><td className="p-3">{sale.customer?.displayName ?? sale.customer?.phone ?? "Client comptoir"}</td><td className="p-3">{type === "cancelled" ? "Annulée" : paid >= total ? "Payée" : "Partiellement payée"}</td><td className="p-3 font-bold">{formatMoney(total)}</td><td className="p-3">{formatMoney(paid)}</td><td className="p-3">{formatMoney(received)}</td><td className="p-3">{paymentSummary.historicalDataUnavailable ? "Donnée historique indisponible" : formatMoney(change)}</td><td className="p-3"><div className="flex gap-3"><button onClick={() => window.alert(`Vente ${sale.id}\nTotal: ${formatMoney(total)}\nMontant réglé: ${formatMoney(paid)}\nMontant reçu: ${formatMoney(received)}\nMonnaie rendue: ${formatMoney(change)}`)} className="text-slate-700 dark:text-slate-200">Voir détail</button><button onClick={() => void printSale(sale.id)} className="text-brand-600 disabled:text-slate-400" disabled={type === "cancelled"}>Imprimer</button></div></td></tr>;
      })}</tbody>
    </table>
    {!sales.length ? <p className="p-5 text-sm text-slate-500">Aucune vente.</p> : null}
  </section>;
}

function uniqueSales(sales: Sale[]) {
  return [...new Map(sales.map((sale) => [sale.id, sale])).values()];
}

function isPaidCompletedSale(sale: Sale) {
  const paid = (sale.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  return sale.status === "COMPLETED" && paid >= Number(sale.total ?? 0);
}

function loadDrafts() {
  if (typeof window === "undefined") return [];
  const user = getCurrentUser();
  const keys = Object.keys(window.localStorage).filter((key) => key === `vta_pos_draft_${user?.tenantId ?? "default"}` || key.startsWith("vta_pos_draft_"));
  return keys.map((key) => {
    try { return { ...JSON.parse(window.localStorage.getItem(key) ?? ""), storageKey: key } as Draft; } catch { return null; }
  }).filter(Boolean) as Draft[];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(value || 0);
}





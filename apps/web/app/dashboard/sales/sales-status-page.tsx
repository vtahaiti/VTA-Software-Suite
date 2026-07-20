"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { clearSession, getAccessToken, getCurrentUser, refreshSession } from "@/lib/auth";
import { getReceiptPrintSettings, openPrintPreview } from "@/lib/print";
import { summarizePayments } from "@/lib/payment-summary";
import { formatBusinessDateTime } from "@/lib/business-timezone";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

type Sale = {
  id: string;
  status: string;
  total: string | number;
  createdAt: string;
  createdByUserId?: string | null;
  createdByUserName?: string | null;
  customer?: { displayName?: string | null; phone?: string | null } | null;
  receipt?: { number: string } | null;
  payments?: Array<{ amount: string | number; receivedAmount?: string | number | null; changeAmount?: string | number | null }>;
};
type SalesSummary = { count: number; total: number; settledAmount: number; receivedAmount: number; changeAmount: number; averageBasket: number };
type CashierOption = { id: string; name: string; isActive: boolean };
type PeriodFilter = "today" | "week" | "month" | "custom";
type Draft = {
  id?: string;
  heldSaleId?: string;
  storageKey?: string;
  cart?: { total: number; items: Array<{ name: string; quantity: number; total?: number }> };
  customerId?: string;
  payments?: Array<{ amount: string }>;
  orderDiscount?: string | number;
  taxRate?: string | number;
  storeId?: string;
  warehouseId?: string;
  cashSessionId?: string;
  status?: "AVAILABLE" | "CLAIMED" | "FINALIZING" | "COMPLETED" | "CANCELLED";
  lockState?: "AVAILABLE" | "CLAIMED_BY_YOU" | "CLAIMED_BY_OTHER" | "EXPIRED" | "FINALIZING";
  canClaim?: boolean;
  canCancel?: boolean;
  claimExpiresAt?: string | null;
  version?: number;
  updatedAt?: string;
};

export function SalesStatusPage({ type }: { type: "in-progress" | "completed" | "cancelled" }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [cashierId, setCashierId] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [cashiers, setCashiers] = useState<CashierOption[]>([]);
  const currentUser = getCurrentUser();
  const canViewAllSales = userCanViewAllSales(currentUser);

  useEffect(() => { setPage(1); }, [type]);
  useEffect(() => { setPage(1); }, [type, period, cashierId, customStart, customEnd]);

  const load = useCallback(async () => {
    setMessage("");
    if (type === "in-progress") {
      setIsLoading(true);
      let token = getAccessToken();
      let response = await fetch(`${apiUrl}/pos/held-sales`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (response?.status === 401 || response?.status === 403) {
        const refreshedUser = await refreshSession();
        token = refreshedUser ? getAccessToken() : null;
        if (!token) {
          clearSession();
          window.location.href = "/login";
          return;
        }
        response = await fetch(`${apiUrl}/pos/held-sales`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      }
      setIsLoading(false);
      if (response?.ok) {
        const data = await response.json();
        setDrafts(uniqueDrafts((data.items ?? []).map(normalizeDraft)));
        return;
      }
      setDrafts(loadDrafts());
      setMessage("Impossible de charger les ventes en attente du serveur. Brouillons locaux affichés.");
      return;
    }
    const status = type === "cancelled" ? "CANCELLED" : "COMPLETED";
    const params = new URLSearchParams({ status, page: String(page), limit: "25" });
    if (type === "completed") {
      params.set("excludeTestData", "true");
      params.set("period", period);
      if (period === "custom") {
        if (customStart) params.set("startDate", customStart);
        if (customEnd) params.set("endDate", customEnd);
      }
      if (canViewAllSales && cashierId !== "all") params.set("cashierId", cashierId);
    }
    let token = getAccessToken();
        setIsLoading(true);
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
        setIsLoading(false);
        if (!response?.ok) {
          setMessage("Impossible de charger les ventes.");
          return;
        }
    const data = await response.json();
    const items = uniqueSales(data.items ?? []);
    setSales(type === "completed" ? items.filter(isPaidCompletedSale) : items);
    setTotal(data.meta?.total ?? items.length);
    setSummary(data.summary ?? null);
    setCashiers(data.cashiers ?? []);
  }, [canViewAllSales, cashierId, customEnd, customStart, page, period, type]);

  useEffect(() => { void load(); }, [load]);

  const title = type === "in-progress" ? "Ventes en cours" : type === "completed" ? "Ventes terminées" : "Ventes annulées";
  const subtitle = type === "in-progress" ? "Brouillons POS, commandes en attente et paiements partiels." : type === "completed" ? "Ventes payées ou clôturées." : "Historique des ventes annulées.";

  const pages = useMemo(() => Math.max(1, Math.ceil(total / 25)), [total]);

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Ventes</p>
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </section>
    {message ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
    {type === "completed" ? (
      <SalesFilters
        period={period}
        cashierId={cashierId}
        customStart={customStart}
        customEnd={customEnd}
        canViewAllSales={canViewAllSales}
        summary={summary}
        cashiers={cashiers}
        onPeriodChange={setPeriod}
        onCashierChange={setCashierId}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />
    ) : null}
    {type === "in-progress" ? <DraftList drafts={drafts} isLoading={isLoading} onReload={() => void load()} /> : <SaleList sales={sales} type={type} isLoading={isLoading} />}
    {type !== "in-progress" ? <Pagination page={page} pages={pages} total={total} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} /> : null}
  </div>;
}

function DraftList({ drafts, isLoading, onReload }: { drafts: Draft[]; isLoading: boolean; onReload: () => void }) {
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Draft | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const canForceHeldSale = userCanForceHeldSale();

  async function continueDraft(draft: Draft) {
    setActionMessage("");
    if (draft.id) {
      const response = await fetchWithAuth(apiUrl + "/pos/held-sales/" + draft.id + "/claim", { method: "POST" }).catch(() => null);
      if (!response?.ok) {
        setActionMessage(response ? await readError(response) : "Impossible de reprendre cette vente en attente.");
        onReload();
        return;
      }
      draft = normalizeDraft(await response.json() as Draft);
    }
    saveDraftForPos(draft);
    window.location.href = "/dashboard/pos";
  }

  async function cancelDraft(draft: Draft) {
    setActionMessage("");
    if (draft.id) {
      const response = await fetchWithAuth(apiUrl + "/pos/held-sales/" + draft.id, { method: "DELETE" }).catch(() => null);
      if (!response?.ok) {
        setActionMessage(response ? await readError(response) : "Annulation impossible.");
        return;
      }
    }
    removeMatchingLocalDraft(draft);
    setCancelTarget(null);
    onReload();
  }

  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h2 className="font-bold">Brouillons POS</h2>
    {actionMessage ? <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{actionMessage}</p> : null}
    <div className="mt-4 grid gap-3">
      {isLoading ? <p className="text-sm text-slate-500">Chargement des ventes en attente...</p> : null}
      {!isLoading && drafts.length ? drafts.map((draft, index) => {
        const lockedByOther = draft.lockState === "CLAIMED_BY_OTHER" || draft.lockState === "FINALIZING";
        const canCancelDraft = draft.lockState !== "FINALIZING" && (draft.canCancel !== false || canForceHeldSale);
        return <div key={draft.id ?? draft.storageKey ?? `${draft.updatedAt}-${index}`} className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <p className="font-semibold">Vente en cours</p>
              <p className="text-sm text-slate-500">{draft.cart?.items.length ?? 0} article(s) - Mise à jour {formatBusinessDateTime(draft.updatedAt)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{heldSaleStatusLabel(draft)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-2 text-xl font-bold text-brand-600">{formatMoney(draft.cart?.total ?? 0)}</p>
              <button onClick={() => void continueDraft(draft)} disabled={lockedByOther || draft.canClaim === false} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Continuer</button>
              <button onClick={() => setSelectedDraft(draft)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Voir détail</button>
              <button onClick={() => setCancelTarget(draft)} disabled={!canCancelDraft} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900">{lockedByOther && canForceHeldSale ? "Annuler (forcer)" : "Annuler"}</button>
            </div>
          </div>
        </div>;
      }) : null}
      {!isLoading && !drafts.length ? <p className="text-sm text-slate-500">Aucune vente en cours.</p> : null}
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
            <button onClick={() => void continueDraft(selectedDraft)} disabled={selectedDraft.lockState === "CLAIMED_BY_OTHER" || selectedDraft.lockState === "FINALIZING"} className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Continuer dans le POS</button>
          </div>
        </div>
      </div>
    ) : null}
    {cancelTarget ? (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-held-sale-title">
        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900">
          <h3 id="cancel-held-sale-title" className="text-lg font-bold">Annuler cette vente en attente ?</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Cette action retirera le brouillon.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setCancelTarget(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Garder</button>
            <button onClick={() => void cancelDraft(cancelTarget)} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white">Annuler la vente</button>
          </div>
        </div>
      </div>
    ) : null}
  </section>;
}

function SalesFilters({
  period,
  cashierId,
  customStart,
  customEnd,
  canViewAllSales,
  summary,
  cashiers,
  onPeriodChange,
  onCashierChange,
  onCustomStartChange,
  onCustomEndChange
}: {
  period: PeriodFilter;
  cashierId: string;
  customStart: string;
  customEnd: string;
  canViewAllSales: boolean;
  summary: SalesSummary | null;
  cashiers: CashierOption[];
  onPeriodChange: (value: PeriodFilter) => void;
  onCashierChange: (value: string) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="grid gap-3 md:grid-cols-4">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Periode
        <select value={period} onChange={(event) => onPeriodChange(event.target.value as PeriodFilter)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="today">Aujourd&apos;hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
          <option value="custom">Personnalise</option>
        </select>
      </label>
      {period === "custom" ? <>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Debut
          <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Fin
          <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        </label>
      </> : null}
      {canViewAllSales ? (
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Caissier
          <select value={cashierId} onChange={(event) => onCashierChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="all">Tous les caissiers</option>
            {cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.name}{cashier.isActive ? "" : " (ancien)"}</option>)}
          </select>
        </label>
      ) : <p className="self-end rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">Vos ventes uniquement</p>}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <SummaryCard label="Ventes" value={String(summary?.count ?? 0)} />
      <SummaryCard label="Total encaisse" value={formatMoney(summary?.total ?? 0)} />
      <SummaryCard label="Montant réglé" value={formatMoney(summary?.settledAmount ?? 0)} />
      <SummaryCard label="Montant reçu" value={formatMoney(summary?.receivedAmount ?? 0)} />
      <SummaryCard label="Monnaie rendue" value={formatMoney(summary?.changeAmount ?? 0)} />
      <SummaryCard label="Panier moyen" value={formatMoney(summary?.averageBasket ?? 0)} />
    </div>
  </section>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{value}</p>
  </div>;
}

function SaleList({ sales, type, isLoading }: { sales: Sale[]; type: "completed" | "cancelled"; isLoading: boolean }) {
  async function printSale(saleId: string) {
    try {
      const settings = await getReceiptPrintSettings();
      await openPrintPreview(`/sales/${saleId}/receipt`, { width: settings.width });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Impossible d'ouvrir l'aperçu du ticket.");
    }
  }

  return <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="grid gap-3 p-3 md:hidden">
      {sales.map((sale) => {
        const paymentSummary = summarizePayments(sale.total, sale.payments ?? []);
        const paid = paymentSummary.settledAmount;
        const received = paymentSummary.receivedAmount;
        const change = paymentSummary.changeAmount;
        const total = paymentSummary.total;
        return <article key={sale.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{formatBusinessDateTime(sale.createdAt)}</p>
              <p className="mt-1 text-sm text-slate-500">{sale.customer?.displayName ?? sale.customer?.phone ?? "Client comptoir"}</p>
              <p className="mt-1 text-xs text-slate-500">Caissier : {sale.createdByUserName ?? "Non renseigne"}</p>
            </div>
            <p className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{type === "cancelled" ? "Annulee" : paid >= total ? "Payee" : "Partielle"}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">Total</span><p className="font-bold">{formatMoney(total)}</p></div>
            <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">Règle</span><p className="font-bold">{formatMoney(paid)}</p></div>
            <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">Reçu</span><p className="font-semibold">{formatMoney(received)}</p></div>
            <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">Monnaie</span><p className="font-semibold">{paymentSummary.historicalDataUnavailable ? "Indisponible" : formatMoney(change)}</p></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => window.alert(`Vente ${sale.id}\nTotal: ${formatMoney(total)}\nMontant réglé: ${formatMoney(paid)}\nMontant reçu: ${formatMoney(received)}\nMonnaie rendue: ${formatMoney(change)}`)} className="rounded-md border border-slate-300 px-3 py-3 text-sm font-semibold dark:border-slate-700">Voir détail</button>
            <button onClick={() => void printSale(sale.id)} className="rounded-md bg-brand-600 px-3 py-3 text-sm font-bold text-white disabled:bg-slate-300" disabled={type === "cancelled"}>Imprimer</button>
          </div>
        </article>;
      })}
    </div>
    <div className="hidden overflow-x-auto md:block">
    <table className="w-full min-w-[920px] text-left text-sm">
      <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Date</th><th className="p-3">Client</th><th className="p-3">Caissier</th><th className="p-3">Statut</th><th className="p-3">Total</th><th className="p-3">Montant réglé</th><th className="p-3">Montant reçu</th><th className="p-3">Monnaie</th><th className="p-3">Actions</th></tr></thead>
      <tbody>{sales.map((sale) => {
        const paymentSummary = summarizePayments(sale.total, sale.payments ?? []);
        const paid = paymentSummary.settledAmount;
        const received = paymentSummary.receivedAmount;
        const change = paymentSummary.changeAmount;
        const total = paymentSummary.total;
        return <tr key={sale.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3">{formatBusinessDateTime(sale.createdAt)}</td><td className="p-3">{sale.customer?.displayName ?? sale.customer?.phone ?? "Client comptoir"}</td><td className="p-3">{sale.createdByUserName ?? "Non renseigne"}</td><td className="p-3">{type === "cancelled" ? "Annulée" : paid >= total ? "Payée" : "Partiellement payée"}</td><td className="p-3 font-bold">{formatMoney(total)}</td><td className="p-3">{formatMoney(paid)}</td><td className="p-3">{formatMoney(received)}</td><td className="p-3">{paymentSummary.historicalDataUnavailable ? "Donnée historique indisponible" : formatMoney(change)}</td><td className="p-3"><div className="flex gap-3"><button onClick={() => window.alert(`Vente ${sale.id}\nCaissier: ${sale.createdByUserName ?? "Non renseigne"}\nTotal: ${formatMoney(total)}\nMontant réglé: ${formatMoney(paid)}\nMontant reçu: ${formatMoney(received)}\nMonnaie rendue: ${formatMoney(change)}`)} className="text-slate-700 dark:text-slate-200">Voir détail</button><button onClick={() => void printSale(sale.id)} className="text-brand-600 disabled:text-slate-400" disabled={type === "cancelled"}>Imprimer</button></div></td></tr>;
      })}</tbody>
    </table>
    </div>
    {isLoading ? <p className="p-5 text-sm text-slate-500">Chargement des ventes...</p> : null}
    {!isLoading && !sales.length ? <p className="p-5 text-sm text-slate-500">Aucune vente.</p> : null}
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
  const key = posDraftKey(user?.tenantId);
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? [normalizeDraft({ ...JSON.parse(raw), storageKey: key })] : [];
  } catch {
    return [];
  }
}

function normalizeDraft(draft: Draft): Draft {
  return {
    ...draft,
    id: draft.id ?? draft.heldSaleId,
    storageKey: draft.storageKey,
    cart: draft.cart,
    customerId: draft.customerId ?? "",
    payments: draft.payments ?? [],
    status: draft.status,
    lockState: draft.lockState,
    canClaim: draft.canClaim,
    canCancel: draft.canCancel,
    claimExpiresAt: draft.claimExpiresAt,
    version: draft.version,
    updatedAt: draft.updatedAt
  };
}

function uniqueDrafts(drafts: Draft[]) {
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    const key = draft.id ? `server:${draft.id}` : draft.storageKey ? `local:${draft.storageKey}` : `local:${draft.updatedAt ?? JSON.stringify(draft.cart ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function heldSaleStatusLabel(draft: Draft) {
  if (draft.lockState === "FINALIZING") return "Finalisation en cours";
  if (draft.lockState === "CLAIMED_BY_YOU") return "Reprise par vous";
  if (draft.lockState === "CLAIMED_BY_OTHER") return "Utilisée par un autre caissier";
  if (draft.lockState === "EXPIRED") return "Verrou expiré";
  return "Disponible";
}

function saveDraftForPos(draft: Draft) {
  if (typeof window === "undefined") return;
  const user = getCurrentUser();
  window.localStorage.setItem(posDraftKey(user?.tenantId), JSON.stringify({
    heldSaleId: draft.id,
    heldSaleFinalizeKey: makeClientId(),
    cart: draft.cart,
    customerId: draft.customerId ?? "",
    payments: draft.payments ?? [],
    orderDiscount: String((draft as Draft & { orderDiscount?: string | number }).orderDiscount ?? 0),
    taxRate: String((draft as Draft & { taxRate?: string | number }).taxRate ?? 0),
    storeId: (draft as Draft & { storeId?: string }).storeId ?? "",
    warehouseId: (draft as Draft & { warehouseId?: string }).warehouseId ?? "",
    cashSessionId: (draft as Draft & { cashSessionId?: string }).cashSessionId ?? "",
    updatedAt: new Date().toISOString()
  }));
}

function removeMatchingLocalDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  const user = getCurrentUser();
  const key = posDraftKey(user?.tenantId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const localDraft = normalizeDraft({ ...JSON.parse(raw), storageKey: key });
    if (draft.storageKey === key || (draft.id && localDraft.id === draft.id)) window.localStorage.removeItem(key);
  } catch {
    if (draft.storageKey) window.localStorage.removeItem(draft.storageKey);
  }
}

function makeClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function posDraftKey(tenantId?: string) {
  return `vta_pos_draft_${tenantId ?? "default"}`;
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Opération impossible";
  } catch {
    return "Opération impossible";
  }
}

function userCanForceHeldSale() {
  const user = getCurrentUser();
  const roles = new Set([user?.role, ...(user?.roles ?? [])].filter(Boolean).map((role) => String(role).toUpperCase()));
  return roles.has("OWNER") || roles.has("ADMIN") || roles.has("MANAGER");
}

function userCanViewAllSales(user: ReturnType<typeof getCurrentUser>) {
  const roles = new Set([user?.role, ...(user?.roles ?? [])].filter(Boolean).map((role) => String(role).toUpperCase()));
  const roleText = [...roles].join(" ");
  const permissions = new Set((user?.permissions ?? []).map((permission) => permission.toLowerCase()));
  const isOwnerOrAdmin = roles.has("OWNER") || roles.has("ADMIN") || roleText.includes("PROPRI") || roles.has("ADMINISTRATOR");
  const isManager = roles.has("MANAGER") || roleText.includes("GERANT") || roleText.includes("GÉRANT");
  return isOwnerOrAdmin || (isManager && (permissions.has("sales.view_all") || permissions.has("sales.view.all") || permissions.has("sales.viewall")));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(value || 0);
}

function Pagination({ page, pages, total, onPrev, onNext }: { page: number; pages: number; total: number; onPrev: () => void; onNext: () => void }) {
  return <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{total} vente{total > 1 ? "s" : ""}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={onPrev} className="rounded-md border px-3 py-2 disabled:opacity-50">Précédent</button><span className="px-3 py-2 text-sm">{page}/{pages}</span><button disabled={page >= pages} onClick={onNext} className="rounded-md border px-3 py-2 disabled:opacity-50">Suivant</button></div></div>;
}

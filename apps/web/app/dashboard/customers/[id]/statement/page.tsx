"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { businessDateKey, formatBusinessDateTime } from "@/lib/business-timezone";
import { formatMoney } from "@/lib/format";

type Movement = { type: "VENTE"; id: string; number: string; date: string; status: string; itemsCount: number; total: number; paid: number; balance: number; cashier: string | null };
type Order = { id: string; number: string; status: string; total: number; paid: number; balance: number; createdAt: string };
type QuoteRow = { id: string; number: string; status: string; total: number; createdAt: string };
type Statement = {
  customer: { id: string; displayName: string; customerCode: string; company?: string; phone?: string; mobile?: string; email?: string; currentBalance: string };
  summary: { totalSales: number; totalPaid: number; balance: number; salesCount: number };
  movements: Movement[];
  orders: Order[];
  quotes: QuoteRow[];
};

type Period = "today" | "month" | "custom";

export default function CustomerStatementPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const today = useMemo(() => businessDateKey(new Date()), []);
  const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today]);
  const [period, setPeriod] = useState<Period>("month");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period === "today") { setDateFrom(today); setDateTo(today); }
    if (period === "month") { setDateFrom(monthStart); setDateTo(today); }
  }, [period, today, monthStart]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, dateFrom, dateTo]);

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const response = await fetch(`${apiUrl}/customers/${customerId}/statement?${params}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      if (!response.ok) throw new Error(await readError(response));
      setStatement(await response.json());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de charger le relevé.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600">Clients</p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Relevé client{statement ? ` — ${statement.customer.displayName}` : ""}</h1>
          {statement ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{statement.customer.customerCode}{statement.customer.company ? ` · ${statement.customer.company}` : ""}{statement.customer.phone ? ` · ${statement.customer.phone}` : ""}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/customers" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Retour aux clients</Link>
          <button onClick={() => window.print()} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Imprimer / PDF</button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <button onClick={() => setPeriod("today")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${period === "today" ? "bg-brand-600 text-white" : "dark:border-slate-700"}`}>Aujourd&apos;hui</button>
        <button onClick={() => setPeriod("month")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${period === "month" ? "bg-brand-600 text-white" : "dark:border-slate-700"}`}>Ce mois</button>
        <button onClick={() => setPeriod("custom")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${period === "custom" ? "bg-brand-600 text-white" : "dark:border-slate-700"}`}>Personnalisé</button>
        {period === "custom" ? (
          <>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </>
        ) : <span className="text-sm text-slate-500">{dateFrom} → {dateTo}</span>}
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
      {isLoading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement du relevé...</div> : null}

      {!isLoading && statement ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="Total ventes" value={formatMoney(statement.summary.totalSales)} detail={`${statement.summary.salesCount} vente(s)`} />
            <SummaryCard label="Total payé" value={formatMoney(statement.summary.totalPaid)} />
            <SummaryCard label="Solde restant" value={formatMoney(statement.summary.balance)} accent={statement.summary.balance > 0} />
          </div>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-5 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Ventes</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Historique chronologique des ventes sur la période.</p>
            </div>
            {statement.movements.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr><th className="p-3 font-semibold">Date</th><th className="p-3 font-semibold">Ticket</th><th className="p-3 font-semibold">Statut</th><th className="p-3 font-semibold">Articles</th><th className="p-3 font-semibold">Total</th><th className="p-3 font-semibold">Payé</th><th className="p-3 font-semibold">Solde</th><th className="p-3 font-semibold">Caissier</th></tr>
                  </thead>
                  <tbody>
                    {statement.movements.map((movement) => (
                      <tr key={movement.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-3 text-slate-700 dark:text-slate-200">{formatBusinessDateTime(movement.date)}</td>
                        <td className="p-3 font-mono text-xs text-slate-500">{movement.number}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-200">{movement.status.replaceAll("_", " ")}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-200">{movement.itemsCount}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-200">{formatMoney(movement.total)}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-200">{formatMoney(movement.paid)}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-200">{formatMoney(movement.balance)}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-200">{movement.cashier ?? "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Aucune vente pour cette période.</div>}
          </section>

          {statement.orders.length || statement.quotes.length ? (
            <section className="grid gap-5 md:grid-cols-2">
              {statement.orders.length ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 p-4 dark:border-slate-800"><h2 className="font-bold text-slate-950 dark:text-white">Commandes</h2></div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statement.orders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 text-sm">
                        <span className="font-mono text-xs text-slate-500">{order.number}</span>
                        <span>{order.status.replaceAll("_", " ")}</span>
                        <span>{formatMoney(order.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {statement.quotes.length ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 p-4 dark:border-slate-800"><h2 className="font-bold text-slate-950 dark:text-white">Devis</h2></div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statement.quotes.map((quote) => (
                      <div key={quote.id} className="flex items-center justify-between p-3 text-sm">
                        <span className="font-mono text-xs text-slate-500">{quote.number}</span>
                        <span>{quote.status.replaceAll("_", " ")}</span>
                        <span>{formatMoney(quote.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-red-600 dark:text-red-400" : "text-slate-950 dark:text-white"}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p> : null}
    </div>
  );
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Impossible de charger le relevé.";
}

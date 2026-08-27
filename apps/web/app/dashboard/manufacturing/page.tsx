"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

type Summary = { toPrepare: number; inProduction: number; ready: number; overdue: number };
type Order = { id: string; manufacturingNumber: string; title: string; status: string; priority: string; expectedDate?: string | null; createdAt: string; customer?: { displayName?: string | null } | null; assignedTo?: { name: string } | null };

const labels: Record<string, string> = { DRAFT: "Brouillon", TO_PREPARE: "À préparer", IN_PRODUCTION: "En fabrication", READY: "Prête", COMPLETED: "Terminée", CANCELLED: "Annulée" };
const badgeClasses: Record<string, string> = { TO_PREPARE: "bg-amber-100 text-amber-800", IN_PRODUCTION: "bg-blue-100 text-blue-800", READY: "bg-emerald-100 text-emerald-800", COMPLETED: "bg-slate-100 text-slate-700", CANCELLED: "bg-red-100 text-red-700" };

export default function ManufacturingPage() {
  const [summary, setSummary] = useState<Summary>({ toPrepare: 0, inProduction: 0, ready: 0, overdue: 0 });
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (status) query.set("status", status);
    try {
      const [ordersResponse, summaryResponse] = await Promise.all([fetchWithAuth(`${apiUrl}/manufacturing?${query}`), fetchWithAuth(`${apiUrl}/manufacturing/summary`)]);
      if (!ordersResponse.ok || !summaryResponse.ok) throw new Error("Impossible de charger les fabrications.");
      setOrders(await ordersResponse.json());
      setSummary(await summaryResponse.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les fabrications.");
    } finally { setLoading(false); }
  }, [search, status]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold text-brand-600">Atelier</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold">Fabrication</h1><p className="mt-1 text-sm text-slate-500">Suivez les ouvrages clients, les matières et l’avancement de l’atelier.</p></div><Link href="/dashboard/sales/proformas" className="rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white">Choisir une commande</Link></div>
    </section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="À préparer" value={summary.toPrepare} color="text-amber-700"/><Kpi label="En fabrication" value={summary.inProduction} color="text-blue-700"/><Kpi label="Prêtes" value={summary.ready} color="text-emerald-700"/><Kpi label="En retard" value={summary.overdue} color="text-red-700"/>
    </section>
    <section className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="grid gap-3 sm:grid-cols-[1fr_220px]">
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher numéro, client ou projet" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/>
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Tous les statuts</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
    </div></section>
    {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
    <section className="overflow-hidden rounded-lg border bg-white dark:border-slate-800 dark:bg-slate-900">
      {loading ? <p className="p-6 text-sm text-slate-500">Chargement...</p> : orders.length === 0 ? <div className="p-8 text-center"><p className="font-semibold">Aucune fabrication</p><p className="mt-1 text-sm text-slate-500">Ouvrez une commande client puis cliquez sur « Lancer en fabrication ».</p></div> : <>
        <div className="space-y-3 p-3 md:hidden">{orders.map((order) => <OrderCard key={order.id} order={order}/>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Nº fabrication</th><th className="p-3">Client</th><th className="p-3">Projet</th><th className="p-3">Date prévue</th><th className="p-3">Responsable</th><th className="p-3">Statut</th><th className="p-3">Priorité</th><th className="p-3"></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t dark:border-slate-800"><td className="p-3 font-mono text-xs">{order.manufacturingNumber}</td><td className="p-3">{order.customer?.displayName ?? "Client comptoir"}</td><td className="p-3 font-semibold">{order.title}</td><td className="p-3">{date(order.expectedDate)}</td><td className="p-3">{order.assignedTo?.name ?? "Non affecté"}</td><td className="p-3"><Status value={order.status}/></td><td className="p-3">{priority(order.priority)}</td><td className="p-3"><Link href={`/dashboard/manufacturing/${order.id}`} className="font-semibold text-brand-600">Ouvrir</Link></td></tr>)}</tbody></table></div>
      </>}
    </section>
  </div>;
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) { return <div className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>; }
function Status({ value }: { value: string }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses[value] ?? "bg-slate-100 text-slate-700"}`}>{labels[value] ?? value}</span>; }
function OrderCard({ order }: { order: Order }) { return <Link href={`/dashboard/manufacturing/${order.id}`} className="block rounded-lg border p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-slate-500">{order.manufacturingNumber}</p><p className="mt-1 font-bold">{order.title}</p><p className="text-sm text-slate-500">{order.customer?.displayName ?? "Client comptoir"}</p></div><Status value={order.status}/></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>Prévue : {date(order.expectedDate)}</span><span>{order.assignedTo?.name ?? "Non affecté"}</span></div></Link>; }
function date(value?: string | null) { return value ? new Date(value).toLocaleDateString("fr-HT") : "Non définie"; }
function priority(value: string) { return value === "URGENT" ? "Urgente" : value === "HIGH" ? "Haute" : "Normale"; }

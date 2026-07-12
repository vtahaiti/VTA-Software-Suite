"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const statusLabels: Record<string, string> = { DRAFT: "Brouillon", SENT: "Envoyée", APPROVED: "Approuvée", PARTIALLY_RECEIVED: "Partiellement reçue", FULLY_RECEIVED: "Reçue", RECEIVED: "Reçue", CANCELLED: "Annulée" };
type PurchaseOrder = { id: string; number: string; status: string; total: string; createdAt: string; supplier?: { name: string }; items: unknown[] };
type Dashboard = { purchasesToday?: number; purchasesMonth?: number; todayPurchases?: number; monthPurchases?: number; activeSuppliers: number; pendingOrders: number; receiptsToday: number; unpaidInvoices: number };

export default function PurchasesPage() {
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { void loadDashboard(); }, []);
  useEffect(() => { const timer = setTimeout(() => void loadPurchases(), 250); return () => clearTimeout(timer); }, [search, status, page]);

  async function authHeaders() { return { Authorization: `Bearer ${getAccessToken()}` }; }
  async function loadDashboard() {
    setDashboardLoading(true);
    try {
      const response = await fetch(`${apiUrl}/purchase-orders/dashboard`, { headers: await authHeaders() });
      if (!response.ok) throw new Error("Tableau achats indisponible");
      setDashboard(await response.json());
    } catch {
      setError("Impossible de charger les indicateurs d’achats.");
    } finally {
      setDashboardLoading(false);
    }
  }
  async function loadPurchases() {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const response = await fetch(`${apiUrl}/purchase-orders?${params}`, { headers: await authHeaders() });
      if (!response.ok) throw new Error("Liste achats indisponible");
      const data = await response.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.meta?.total ?? 0));
    } catch {
      setError("Impossible de charger les bons de commande.");
    } finally {
      setListLoading(false);
    }
  }
  async function exportFile(format: "csv" | "excel" | "pdf") { const response = await fetch(`${apiUrl}/purchase-orders/export/${format}`, { headers: await authHeaders() }); if (!response.ok) return; const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `achats.${format === "excel" ? "xls" : format}`; link.click(); URL.revokeObjectURL(url); }

  const pages = useMemo(() => Math.max(1, Math.ceil(total / 10)), [total]);
  const purchasesToday = dashboard?.purchasesToday ?? dashboard?.todayPurchases ?? 0;
  const purchasesMonth = dashboard?.purchasesMonth ?? dashboard?.monthPurchases ?? 0;
  const cards = [
    ["Achats du jour", purchasesToday],
    ["Achats du mois", purchasesMonth],
    ["Fournisseurs actifs", dashboard?.activeSuppliers ?? 0],
    ["Commandes en attente", dashboard?.pendingOrders ?? 0],
    ["Réceptions aujourd’hui", dashboard?.receiptsToday ?? 0],
    ["Factures impayées", dashboard?.unpaidInvoices ?? 0]
  ];

  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center"><div><p className="text-sm font-medium text-brand-600">Achats</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Bons de commande</h1><p className="mt-1 text-sm text-slate-500">Suivi fournisseurs, commandes, réceptions, factures et paiements.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>exportFile("csv")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">CSV</button><button onClick={()=>exportFile("excel")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Excel</button><button onClick={()=>exportFile("pdf")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">PDF</button><Link href="/dashboard/purchases/receipts" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Réception marchandises</Link><Link href="/dashboard/purchases/create" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Nouveau bon</Link></div></div>{error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={()=>{setError(""); void loadDashboard(); void loadPurchases();}} className="ml-3 font-semibold underline">Réessayer</button></div> : null}<div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{dashboardLoading ? Array.from({ length: 6 }).map((_, index)=><div key={index} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />) : cards.map(([label,value])=><div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p></div>)}</div><div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2"><input value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1)}} placeholder="Recherche par numéro, fournisseur, produit ou facture" className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><select value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1)}} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Tous les statuts</option><option value="DRAFT">Brouillon</option><option value="SENT">Envoyée</option><option value="APPROVED">Approuvée</option><option value="PARTIALLY_RECEIVED">Partiellement reçue</option><option value="FULLY_RECEIVED">Reçue</option><option value="CANCELLED">Annulée</option></select></div><div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Numéro</th><th className="p-3">Fournisseur</th><th className="p-3">Lignes</th><th className="p-3">Total</th><th className="p-3">Statut</th><th className="p-3">Date</th><th className="p-3">Action</th></tr></thead><tbody>{items.map((order)=><tr key={order.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-mono text-xs">{order.number}</td><td className="p-3 font-medium">{order.supplier?.name ?? "--"}</td><td className="p-3">{order.items.length}</td><td className="p-3">{order.total}</td><td className="p-3">{statusLabels[order.status] ?? order.status}</td><td className="p-3">{new Date(order.createdAt).toLocaleDateString("fr-FR")}</td><td className="p-3"><Link className="text-brand-600" href={`/dashboard/purchases/${order.id}`}>Voir</Link></td></tr>)}</tbody></table>{listLoading ? <p className="p-5 text-sm text-slate-500">Chargement des bons de commande...</p> : items.length===0 ? <p className="p-5 text-sm text-slate-500">Aucun bon de commande.</p> : null}</div><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{listLoading ? "Chargement..." : `${total} bons de commande`}</p><div className="flex gap-2"><button disabled={page<=1 || listLoading} onClick={()=>setPage(page-1)} className="rounded-md border px-3 py-2 disabled:opacity-50">Précédent</button><span className="px-3 py-2 text-sm">{page}/{pages}</span><button disabled={page>=pages || listLoading} onClick={()=>setPage(page+1)} className="rounded-md border px-3 py-2 disabled:opacity-50">Suivant</button></div></div></div>;
}

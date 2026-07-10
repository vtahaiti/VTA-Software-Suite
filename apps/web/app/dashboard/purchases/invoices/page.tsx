"use client";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const statusLabels: Record<string, string> = { DRAFT: "Brouillon", APPROVED: "Approuvée", PARTIALLY_PAID: "Partiellement payée", PAID: "Payée", CANCELLED: "Annulée" };
type SupplierInvoice = { id: string; number: string; invoiceNumber?: string; status: string; total: string; balance: string; invoiceDate: string; supplier?: { name: string } };

export default function SupplierInvoicesPage() {
  const [items, setItems] = useState<SupplierInvoice[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { const timer = setTimeout(() => load(), 250); return () => clearTimeout(timer); }, [search]);
  async function load() {
    const params = new URLSearchParams({ limit: "50" });
    if (search) params.set("search", search);
    const response = await fetch(`${apiUrl}/purchase-orders/invoices?${params}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) { const data = await response.json(); setItems(Array.isArray(data) ? data : data.items ?? []); }
  }
  async function printInvoice(id: string) { const response = await fetch(`${apiUrl}/purchase-orders/invoices/${id}/print`, { headers: { Authorization: `Bearer ${getAccessToken()}` } }); if (!response.ok) return; const text = await response.text(); const win = window.open("", "_blank"); if (win) { win.document.write(`<pre style="font-family: monospace; white-space: pre-wrap; padding: 24px">${text}</pre>`); win.document.close(); win.print(); } }
  return <div className="space-y-5"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Achats</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Factures fournisseurs</h1><p className="mt-1 text-sm text-slate-500">Suivi des factures liees aux bons de commande.</p></div><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Recherche fournisseur ou facture" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"/><div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Numéro</th><th className="p-3">Facture</th><th className="p-3">Fournisseur</th><th className="p-3">Total</th><th className="p-3">Solde</th><th className="p-3">Statut</th><th className="p-3">Action</th></tr></thead><tbody>{items.map((item)=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-mono text-xs">{item.number}</td><td className="p-3">{item.invoiceNumber ?? "--"}</td><td className="p-3 font-medium">{item.supplier?.name ?? "--"}</td><td className="p-3">{item.total}</td><td className="p-3">{item.balance}</td><td className="p-3">{statusLabels[item.status] ?? item.status}</td><td className="p-3"><button onClick={()=>printInvoice(item.id)} className="text-brand-600">Imprimer</button></td></tr>)}</tbody></table>{items.length===0 ? <p className="p-5 text-sm text-slate-500">Aucune facture fournisseur.</p> : null}</div></div>;
}

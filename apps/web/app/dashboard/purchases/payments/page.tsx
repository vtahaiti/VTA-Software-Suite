"use client";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));
type SupplierPayment = { id: string; number: string; method: string; amount: string; paidAt: string; supplier?: { name: string }; supplierInvoice?: { number: string } };
const methodLabels: Record<string, string> = { CASH: "Comptant", CREDIT: "Credit", CARD: "Carte", BANK_TRANSFER: "Virement", MIXED: "Mixte" };

export default function SupplierPaymentsPage() {
  const [items, setItems] = useState<SupplierPayment[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { const timer = setTimeout(() => load(), 250); return () => clearTimeout(timer); }, [search]);
  async function load() {
    const params = new URLSearchParams({ limit: "50" });
    if (search) params.set("search", search);
    const response = await fetch(`${apiUrl}/purchase-orders/payments?${params}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) { const data = await response.json(); setItems(Array.isArray(data) ? data : data.items ?? []); }
  }
  return <div className="space-y-5"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Achats</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Paiements fournisseurs</h1><p className="mt-1 text-sm text-slate-500">Historique des paiements comptants, crédits et partiels.</p></div><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Recherche paiement ou fournisseur" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"/><div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Numéro</th><th className="p-3">Fournisseur</th><th className="p-3">Facture</th><th className="p-3">Méthode</th><th className="p-3">Montant</th><th className="p-3">Date</th></tr></thead><tbody>{items.map((item)=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-mono text-xs">{item.number}</td><td className="p-3 font-medium">{item.supplier?.name ?? "--"}</td><td className="p-3">{item.supplierInvoice?.number ?? "--"}</td><td className="p-3">{methodLabels[item.method] ?? item.method}</td><td className="p-3">{item.amount}</td><td className="p-3">{new Date(item.paidAt).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table>{items.length===0 ? <p className="p-5 text-sm text-slate-500">Aucun paiement fournisseur.</p> : null}</div></div>;
}
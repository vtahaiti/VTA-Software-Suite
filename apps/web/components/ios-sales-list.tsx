"use client";
import { useState } from "react";
import { ChevronRight, ReceiptText, Printer } from "lucide-react";
import { IosSheet } from "@/components/ios-sheet";
import { summarizePayments } from "@/lib/payment-summary";
import { formatBusinessDateTime } from "@/lib/business-timezone";
type Sale = { id: string; total: string | number; createdAt: string; createdByUserName?: string | null; customer?: { displayName?: string | null; phone?: string | null } | null; receipt?: { number: string } | null; payments?: { amount: string | number; receivedAmount?: string | number | null; changeAmount?: string | number | null }[] };
const money = (value: number) => new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG",maximumFractionDigits:2}).format(value);
export function IosSalesList({ sales, cancelled, loading, onPrint }: { sales: Sale[]; cancelled: boolean; loading: boolean; onPrint: (id: string) => Promise<void> }) {
  const [selected, setSelected] = useState<Sale | null>(null);
  const totals = selected ? summarizePayments(selected.total, selected.payments ?? []) : null;
  if (loading) return <div className="vm-state" role="status">Chargement des ventes…</div>;
  return <>{!sales.length ? <div className="vm-state"><ReceiptText size={28}/><strong>Aucune vente pour cette période</strong></div> : <div className="vm-sales-list">{sales.map(sale => <button className="vm-sale-row" key={sale.id} onClick={() => setSelected(sale)}><span className="vm-sale-icon"><ReceiptText size={20}/></span><span className="vm-record-name"><strong>{sale.receipt?.number || "Vente"}</strong><small>{sale.customer?.displayName || "Client comptoir"}</small><small>{formatBusinessDateTime(sale.createdAt)}</small></span><span className="vm-record-value"><strong>{money(Number(sale.total))}</strong><small className={cancelled ? "vm-red" : ""}>{cancelled ? "Annulée" : "Terminée"}</small></span><ChevronRight size={15}/></button>)}</div>}{selected && totals && <IosSheet title={selected.receipt?.number || "Détail de la vente"} subtitle={formatBusinessDateTime(selected.createdAt)} onClose={() => setSelected(null)}><dl className="vm-detail-rows">{[["Client",selected.customer?.displayName || selected.customer?.phone || "Client comptoir"],["Caissier",selected.createdByUserName || "Non renseigné"],["Total",money(totals.total)],["Montant réglé",money(totals.settledAmount)],["Montant reçu",money(totals.receivedAmount)],["Monnaie",totals.historicalDataUnavailable ? "Indisponible" : money(totals.changeAmount)]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{!cancelled && <button className="vm-primary-button" onClick={() => void onPrint(selected.id)}><Printer size={18}/>Imprimer le ticket</button>}</IosSheet>}</>;
}

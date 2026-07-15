"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { downloadPdf, openPrintPreview } from "@/lib/print";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoye",
  ACCEPTED: "Accepte",
  REJECTED: "Refuse",
  CONVERTED: "Transforme",
  CONFIRMED: "Confirmee",
  IN_PROGRESS: "En cours / En fabrication",
  READY: "Prete pour livraison/installation",
  DELIVERED: "Livree",
  COMPLETED: "Terminee",
  PAID: "Paye",
  PARTIALLY_PAID: "Partiellement paye",
  CANCELLED: "Annule",
  RETURNED: "Retourne"
};

type Props = { type: "quotes" | "proformas" | "invoices"; title: string; transformAction?: string; transformLabel?: string };

export function SalesDocumentDetailPage({ type, title, transformAction, transformLabel }: Props) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [payment, setPayment] = useState({ method: "CASH", amount: "", reference: "", notes: "" });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`${apiUrl}/${type}/${params.id}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) setDoc(await response.json());
  }, [params.id, type]);

  useEffect(() => { void load(); }, [load]);

  async function action(name: string) {
    const response = await fetch(`${apiUrl}/${type}/${params.id}/${name}`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!response.ok) return;
    const data = await response.json();
    setMessage("Action executee.");
    if (data.id && name.includes("to-")) {
      const next = name === "to-proforma" ? "proformas" : "invoices";
      router.push(`/dashboard/sales/${next}/${data.id}`);
    } else {
      await load();
    }
  }

  async function pay(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiUrl}/invoices/${params.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ ...payment, amount: Number(payment.amount) })
    });
    if (response.ok) {
      setMessage("Paiement enregistre.");
      setPayment({ method: "CASH", amount: "", reference: "", notes: "" });
      setDoc(await response.json());
    } else {
      setMessage("Paiement impossible.");
    }
  }

  if (!doc) return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">Chargement...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <p className="font-mono text-xs text-slate-500">{doc.documentNumber ?? doc.number}</p>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-slate-500">Client: {doc.customer?.displayName ?? doc.customer?.name ?? "--"} - {statusLabels[doc.status] ?? doc.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {type === "invoices" ? (
            <>
              <button onClick={() => void openPrintPreview(`/invoices/${params.id}/print`)} className="rounded-md border px-4 py-2 text-sm">Apercu avant impression</button>
              <button onClick={() => void openPrintPreview(`/invoices/${params.id}/print`)} className="rounded-md border px-4 py-2 text-sm">Imprimer facture</button>
              <button onClick={() => void downloadPdf(`/invoices/${params.id}/pdf`, `facture-${doc.documentNumber ?? doc.number}.pdf`)} className="rounded-md border px-4 py-2 text-sm">Telecharger PDF</button>
            </>
          ) : <button onClick={() => window.print()} className="rounded-md border px-4 py-2 text-sm">Imprimer</button>}
          {transformAction ? <button onClick={() => void action(transformAction)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{transformLabel}</button> : null}
          {type === "invoices" ? <button onClick={() => void action("cancel")} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700">Annuler</button> : null}
          <Link href={`/dashboard/sales/${type}`} className="rounded-md border px-4 py-2 text-sm">Retour</Link>
        </div>
      </div>

      {message ? <p className="rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Info label="Total" value={doc.total} />
        <Info label="Paye" value={doc.paidAmount} />
        <Info label="Solde" value={doc.balance} />
        <div className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Impression</p>
          <p className="text-sm">Ticket 58/80 mm, A4/Letter</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
            <tr><th className="p-3">Produit</th><th className="p-3">Qte</th><th className="p-3">Prix</th><th className="p-3">Remise</th><th className="p-3">Taxe</th><th className="p-3">Total</th></tr>
          </thead>
          <tbody>
            {doc.items?.map((item: any) => (
              <tr key={item.id} className="border-t dark:border-slate-800">
                <td className="p-3">
                  <span className="font-medium">{item.product?.name ?? item.customName ?? "Service"}</span>
                  {item.customType && !item.product ? <span className="mt-1 block text-xs text-slate-500">Type: {String(item.customType).replaceAll("_", " ")}</span> : null}
                  {item.customNote ? <span className="mt-1 block whitespace-pre-wrap text-xs leading-5 text-slate-500">{item.customNote}</span> : null}
                </td>
                <td className="p-3">{item.quantity}</td>
                <td className="p-3">{item.unitPrice}</td>
                <td className="p-3">{item.discount}</td>
                <td className="p-3">{item.tax}</td>
                <td className="p-3">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {type === "invoices" ? (
        <form onSubmit={pay} className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Enregistrer paiement</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })} className="rounded-md border px-3 py-2 dark:bg-slate-950">
              <option value="CASH">Especes</option>
              <option value="CARD">Carte</option>
              <option value="BANK_TRANSFER">Virement</option>
              <option value="MIXED">Mixte</option>
            </select>
            <input required type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} placeholder="Montant" className="rounded-md border px-3 py-2 dark:bg-slate-950" />
            <input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} placeholder="Reference" className="rounded-md border px-3 py-2 dark:bg-slate-950" />
            <input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} placeholder="Notes" className="rounded-md border px-3 py-2 dark:bg-slate-950" />
          </div>
          <button className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer paiement</button>
        </form>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

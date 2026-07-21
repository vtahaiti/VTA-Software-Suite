"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { getCompanyBranding, type CompanyBranding } from "@/lib/company-branding";
import { downloadPdf, openPrintPreview } from "@/lib/print";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
  CONVERTED: "Converti",
  CONFIRMED: "Confirmée",
  IN_PROGRESS: "En cours / En fabrication",
  READY: "Prête pour livraison/installation",
  DELIVERED: "Livrée",
  COMPLETED: "Terminée",
  PAID: "Payée",
  PARTIALLY_PAID: "Avance reçue",
  CANCELLED: "Annulée",
  RETURNED: "Retournée"
};

const orderStatuses = ["CONFIRMED", "IN_PROGRESS", "READY", "DELIVERED", "COMPLETED", "CANCELLED"];

export function SalesDocumentDetailPage({ type, title, transformAction, transformLabel }: { type: string; title: string; transformAction?: string; transformLabel?: string }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [payment, setPayment] = useState({ method: "CASH", amount: "", reference: "", notes: "" });
  const [message, setMessage] = useState("");
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`${apiUrl}/${type}/${params.id}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) setDoc(await response.json());
  }, [params.id, type]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const token = getAccessToken();
    if (token) void getCompanyBranding(token).then(setBranding).catch(() => setBranding(null));
  }, []);

  async function action(name: string) {
    const response = await fetch(`${apiUrl}/${type}/${params.id}/${name}`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!response.ok) return;
    const data = await response.json();
    setMessage("Action exécutée.");
    if (data.id && name.includes("to-")) {
      const next = name === "to-proforma" ? "proformas" : "invoices";
      router.push(`/dashboard/sales/${next}/${data.id}`);
    } else {
      setDoc(data);
    }
  }

  async function pay(event: FormEvent) {
    event.preventDefault();
    const paymentPath = type === "proformas" ? "proformas" : "invoices";
    const response = await fetch(`${apiUrl}/${paymentPath}/${params.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ ...payment, amount: Number(payment.amount) })
    });
    if (response.ok) {
      setMessage(type === "proformas" ? "Avance / balance enregistrée." : "Paiement enregistré.");
      setPayment({ method: "CASH", amount: "", reference: "", notes: "" });
      setDoc(await response.json());
    } else {
      const body = await response.json().catch(() => null);
      setMessage(body?.message ?? "Paiement impossible.");
    }
  }

  async function updateStatus(status: string) {
    if (type !== "proformas") return;
    const response = await fetch(`${apiUrl}/proformas/${params.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ status })
    });
    if (response.ok) {
      setMessage("Statut mis à jour.");
      setDoc(await response.json());
    } else {
      const body = await response.json().catch(() => null);
      setMessage(body?.message ?? "Statut impossible.");
    }
  }

  async function printPage() {
    await waitForPrintableImages();
    window.print();
  }

  if (!doc) return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">Chargement...</div>;
  const canPay = (type === "proformas" || type === "invoices") && Number(doc.balance) > 0 && !["DRAFT", "CANCELLED"].includes(doc.status);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-600">Devis & Commandes</p>
            <h1 className="text-2xl font-bold">{title} {doc.documentNumber ?? doc.number}</h1>
            <p className="text-sm text-slate-500">Client: {doc.customer?.displayName ?? doc.customer?.name ?? "--"} - {statusLabels[doc.status] ?? doc.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {type === "invoices" ? (
              <>
                <button onClick={() => void openPrintPreview(`/invoices/${params.id}/print`)} className="rounded-md border px-4 py-2 text-sm">Aperçu avant impression</button>
                <button onClick={() => void openPrintPreview(`/invoices/${params.id}/print`)} className="rounded-md border px-4 py-2 text-sm">Imprimer facture</button>
                <button onClick={() => void downloadPdf(`/invoices/${params.id}/pdf`, `facture-${doc.documentNumber ?? doc.number}.pdf`)} className="rounded-md border px-4 py-2 text-sm">Télécharger PDF</button>
              </>
            ) : <button onClick={() => void printPage()} className="rounded-md border px-4 py-2 text-sm">Imprimer</button>}
            {transformAction ? <button onClick={() => void action(transformAction)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{transformLabel}</button> : null}
            {type === "invoices" ? <button onClick={() => void action("cancel")} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700">Annuler</button> : null}
            <Link href={`/dashboard/sales/${type}`} className="rounded-md border px-4 py-2 text-sm">Retour</Link>
          </div>
        </div>
        {message ? <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Info label="Total" value={doc.total} />
        <Info label="Avance" value={doc.paidAmount} />
        <Info label="Balance" value={doc.balance} />
        <Info label="Statut paiement" value={statusLabels[doc.paymentStatus] ?? doc.paymentStatus ?? statusLabels[doc.status] ?? doc.status} />
      </div>

      <div className="printable-document overflow-hidden rounded-lg border bg-white dark:border-slate-800 dark:bg-slate-900">
        <PrintBrandHeader branding={branding} title={title} number={doc.documentNumber ?? doc.number} />
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
            <tr><th className="p-3">Produit</th><th className="p-3">Qté</th><th className="p-3">Prix</th><th className="p-3">Remise</th><th className="p-3">Taxe</th><th className="p-3">Total</th></tr>
          </thead>
          <tbody>
            {doc.items?.map((item: any) => (
              <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3">
                  <p className="font-medium">{item.product?.name ?? item.customName ?? "Service"}</p>
                  {item.customNote ? <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.customNote}</p> : null}
                </td>
                <td className="p-3">{item.quantity}</td>
                <td className="p-3">{item.unitPrice}</td>
                <td className="p-3">{item.discount}</td>
                <td className="p-3">{item.tax}</td>
                <td className="p-3 font-semibold">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {type === "proformas" ? (
        <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Statut commande</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {orderStatuses.map((status) => <button key={status} onClick={() => void updateStatus(status)} className="rounded-md border px-4 py-2 text-sm">{statusLabels[status]}</button>)}
          </div>
        </div>
      ) : null}

      {canPay ? (
        <form onSubmit={pay} className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">{type === "proformas" ? "Ajouter avance / encaisser balance" : "Enregistrer paiement"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })} className="rounded-md border px-3 py-2 dark:bg-slate-950">
              <option value="CASH">Espèces</option>
              <option value="CARD">Carte</option>
              <option value="BANK_TRANSFER">Virement</option>
              <option value="MIXED">Mixte</option>
            </select>
            <input required type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} placeholder={type === "proformas" ? "Montant avance ou balance" : "Montant"} className="rounded-md border px-3 py-2 dark:bg-slate-950" />
            <input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} placeholder="Référence" className="rounded-md border px-3 py-2 dark:bg-slate-950" />
            <input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} placeholder="Notes" className="rounded-md border px-3 py-2 dark:bg-slate-950" />
          </div>
          <button className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{type === "proformas" ? "Enregistrer avance / balance" : "Enregistrer paiement"}</button>
        </form>
      ) : null}
    </div>
  );
}

function PrintBrandHeader({ branding, title, number }: { branding: CompanyBranding | null; title: string; number: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [branding?.logoUrl]);
  const companyName = branding?.companyName ?? "Mon entreprise";
  return (
    <div className="mb-5 hidden items-start justify-between gap-6 border-b border-slate-200 pb-4 print:flex">
      <div className="flex items-start gap-3">
        {branding?.logoUrl && !logoFailed ? (
          <img src={branding.logoUrl} alt={`Logo ${companyName}`} onError={() => setLogoFailed(true)} className="h-16 w-16 rounded-lg object-contain" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-900 text-lg font-bold text-white">{branding?.companyInitials ?? "ME"}</div>
        )}
        <div>
          <p className="text-lg font-bold text-slate-950">{companyName}</p>
          {branding?.address ? <p className="text-xs text-slate-600">{branding.address}</p> : null}
          {branding?.phone ? <p className="text-xs text-slate-600">Tél: {branding.phone}</p> : null}
          {branding?.email ? <p className="text-xs text-slate-600">{branding.email}</p> : null}
          {branding?.taxNumber ? <p className="text-xs text-slate-600">NIF: {branding.taxNumber}</p> : null}
        </div>
      </div>
      <div className="text-right">
        <p className="text-xl font-black uppercase text-slate-950">{title}</p>
        <p className="font-mono text-xs text-slate-500">{number}</p>
      </div>
    </div>
  );
}

async function waitForPrintableImages() {
  if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined);
  const printable = document.querySelector(".printable-document");
  const images = Array.from(printable?.querySelectorAll("img") ?? []);
  await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  })));
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{String(value ?? "--")}</p>
    </div>
  );
}

"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { getCompanyBranding, type CompanyBranding } from "@/lib/company-branding";

const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
  CONVERTED: "Converti en commande",
  CONFIRMED: "Commande en cours",
  COMPLETED: "Vente terminée",
  CANCELLED: "Annulée",
  UNPAID: "Non payée",
  PARTIALLY_PAID: "Avance reçue",
  PAID: "Payée"
};

function money(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

  function goToConversion() {
    if (!transformAction) return;
    router.push(`/dashboard/sales/proformas/create?fromQuote=${params.id}`);
  }

  async function cancelOrder() {
    if (type !== "proformas") return;
    if (!window.confirm("Annuler cette commande ? Le stock sorti sera remis en inventaire.")) return;
    const response = await fetch(`${apiUrl}/proformas/${params.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ status: "CANCELLED" })
    });
    if (response.ok) {
      setDoc(await response.json());
      setMessage("Commande annulée, stock remis en inventaire.");
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(body?.message ?? "Annulation impossible.");
  }

  async function registerPayment(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiUrl}/proformas/${params.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ ...payment, amount: Number(payment.amount) })
    });
    if (response.ok) {
      setDoc(await response.json());
      setPayment({ method: "CASH", amount: "", reference: "", notes: "" });
      setMessage("Avance / balance enregistrée.");
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(body?.message ?? "Paiement impossible.");
  }

  async function printPage() {
    await waitForPrintableImages();
    window.print();
  }

  if (!doc) return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">Chargement...</div>;
  const canPay = type === "proformas" && Number(doc.balance ?? 0) > 0 && !["DRAFT", "CANCELLED"].includes(doc.status);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-600">Devis & Commandes</p>
            <h1 className="text-2xl font-bold">{title} {doc.documentNumber ?? doc.number}</h1>
            <p className="text-sm text-slate-500">Client: {doc.customer?.displayName ?? doc.customer?.name ?? "--"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void printPage()} className="rounded-md border px-4 py-2 text-sm">Imprimer</button>
            {transformAction ? <button onClick={goToConversion} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{transformLabel ?? "Convertir en commande"}</button> : null}
            <Link href={`/dashboard/sales/${type}`} className="rounded-md border px-4 py-2 text-sm">Retour</Link>
          </div>
        </div>
        {message ? <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p> : null}
      </section>

      <section className={`grid gap-4 print:hidden ${type === "quotes" ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
        <Info label="Total" value={money(doc.total)} />
        {type !== "quotes" ? <Info label="Avance" value={money(doc.paidAmount)} /> : null}
        {type !== "quotes" ? <Info label="Balance" value={money(doc.balance)} /> : null}
        <Info label="Statut" value={statusLabels[doc.paymentStatus] ?? statusLabels[doc.status] ?? doc.status} />
      </section>

      <section className="printable-document overflow-hidden rounded-lg border bg-white dark:border-slate-800 dark:bg-slate-900">
        <PrintBrandHeader branding={branding} title={title} number={doc.documentNumber ?? doc.number} />
        <div className="p-5 print:p-0">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-4 print:border-slate-300">
            <div>
              <p className="font-mono text-xs text-slate-500 print:hidden">{doc.documentNumber ?? doc.number}</p>
              <h2 className="text-lg font-semibold print:hidden">{title}</h2>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">Client: {doc.customer?.displayName ?? doc.customer?.name ?? "Client comptoir"}</p>
              {doc.customer?.customerCode ? <p className="text-xs text-slate-500">N° client: {doc.customer.customerCode}</p> : null}
            </div>
            <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString("fr-FR")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm print:min-w-0">
              <thead className="bg-slate-50 text-slate-500 print:bg-white">
                <tr><th className="p-3">Produit / service</th><th className="p-3">Quantité</th><th className="p-3">Prix</th><th className="p-3">Remise</th><th className="p-3">Total</th></tr>
              </thead>
              <tbody>
                {doc.items?.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <p className="font-medium">{item.product?.name ?? item.customName ?? "Service"}</p>
                      {item.customNote ? <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.customNote}</p> : null}
                    </td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{money(item.unitPrice)}</td>
                    <td className="p-3">{money(item.discount)}</td>
                    <td className="p-3 font-semibold">{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`mt-4 grid gap-2 text-sm ${type === "quotes" ? "md:w-64 md:grid-cols-1 print:w-64 print:grid-cols-1 md:ml-auto print:ml-auto" : "md:grid-cols-3 print:grid-cols-3"}`}>
            <Info label="Total" value={money(doc.total)} />
            {type !== "quotes" ? <Info label="Avance" value={money(doc.paidAmount)} /> : null}
            {type !== "quotes" ? <Info label="Balance" value={money(doc.balance)} /> : null}
          </div>
          {doc.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">{doc.notes}</p> : null}
          {type === "quotes" ? (
            <div className="mt-8">
              <p className="text-sm text-slate-500">
                {doc.expiresAt ? `Ce devis est valide jusqu'au ${new Date(doc.expiresAt).toLocaleDateString("fr-FR")}.` : "Ce devis est valide 7 jours."}
              </p>
              <div className="mt-10 grid grid-cols-2 gap-8">
                <div className="border-t border-slate-300 pt-2 text-xs text-slate-500">Signature du client</div>
                <div className="border-t border-slate-300 pt-2 text-xs text-slate-500">Signature de l&apos;entreprise</div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {type === "proformas" && !["CANCELLED", "COMPLETED"].includes(doc.status) ? (
        <section className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:hidden">
          <h2 className="text-lg font-semibold">Commande</h2>
          <p className="mt-1 text-sm text-slate-500">Le stock a été sorti à la création de cette commande. Une annulation le remet en inventaire.</p>
          <button onClick={() => void cancelOrder()} className="mt-4 rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:text-red-300">Annuler la commande</button>
        </section>
      ) : null}

      {canPay ? (
        <form onSubmit={registerPayment} className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:hidden">
          <h2 className="text-lg font-semibold">{Number(doc.paidAmount ?? 0) > 0 ? "Encaisser la balance" : "Ajouter une avance"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })} className="rounded-md border px-3 py-2 dark:bg-slate-950">
              <option value="CASH">Espèces</option>
              <option value="CARD">Carte</option>
              <option value="BANK_TRANSFER">Virement</option>
              <option value="MIXED">Mixte</option>
            </select>
            <input required type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} placeholder="Montant" className="rounded-md border px-3 py-2 dark:bg-slate-950" />
            <input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} placeholder="Référence" className="rounded-md border px-3 py-2 dark:bg-slate-950" />
            <input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} placeholder="Notes" className="rounded-md border px-3 py-2 dark:bg-slate-950" />
          </div>
          <button className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button>
        </form>
      ) : null}
    </div>
  );
}

function PrintBrandHeader({ branding, title, number }: { branding: CompanyBranding | null; title: string; number: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => { setLogoFailed(false); }, [branding?.logoUrl]);
  const companyName = branding?.companyName ?? "Mon entreprise";
  return (
    <div className="hidden items-start justify-between gap-6 border-b border-slate-200 pb-4 print:flex">
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
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

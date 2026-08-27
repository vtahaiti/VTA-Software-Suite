"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";
import { getAccessToken } from "@/lib/auth";

const statusLabels: Record<string, string> = { ACTIVE: "Actif", INACTIVE: "Inactif", BLOCKED: "Bloqué" };
const typeLabels: Record<string, string> = { INDIVIDUAL: "Particulier", BUSINESS: "Entreprise", VIP: "VIP", WHOLESALE: "Grossiste", GOVERNMENT: "Gouvernement" };

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const loadCustomer = useCallback(async () => {
    const response = await fetch(`${apiUrl}/customers/${params.id}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) setCustomer(await response.json());
  }, [params.id]);
  useEffect(() => { void loadCustomer(); }, [loadCustomer]);
  async function action(name: string) { await fetch(`${apiUrl}/customers/${params.id}/${name}`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } }); await loadCustomer(); }
  if (!customer) return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">Chargement du client...</div>;
  const information = [["Prénom", customer.firstName], ["Nom", customer.lastName], ["Entreprise", customer.company], ["Numéro fiscal", customer.taxNumber], ["Téléphone", customer.phone], ["Mobile", customer.mobile], ["WhatsApp", customer.whatsapp], ["Email", customer.email]];
  const address = [["Pays", customer.country], ["Ville", customer.city], ["Code postal", customer.postalCode], ["Site web", customer.website], ["Adresse", customer.address]];
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center"><div><p className="font-mono text-xs text-slate-500">{customer.customerCode}</p><h1 className="text-2xl font-bold">{customer.displayName}</h1><p className="mt-1 text-sm text-slate-500">{typeLabels[customer.customerType] ?? customer.customerType} · {statusLabels[customer.status] ?? customer.status}</p></div><div className="flex flex-wrap gap-2"><Link href={`/dashboard/customers/${customer.id}/edit`} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Modifier</Link><button onClick={() => void action("block")} className="rounded-md border px-4 py-2 text-sm">Bloquer</button><button onClick={() => void action("reactivate")} className="rounded-md border px-4 py-2 text-sm">Réactiver</button><button onClick={() => void action("archive")} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700">Archiver</button></div></div>
    <div className="grid gap-4 md:grid-cols-3"><Metric label="Solde" value={customer.currentBalance} /><Metric label="Limite de crédit" value={customer.creditLimit} /><Metric label="Documents" value={(customer.documents?.quotes ?? 0) + (customer.documents?.proformas ?? 0) + (customer.documents?.invoices ?? 0)} /></div>
    <div className="grid gap-5 xl:grid-cols-2"><Details title="Informations" rows={information} /><Details title="Adresse" rows={address} /><section className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Historique</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Count label="POS" value={customer.history?.pos?.length} /><Count label="Paiements" value={customer.history?.payments?.length} /><Count label="Retours" value={customer.history?.returns?.length} /><Count label="Factures" value={customer.history?.invoices?.length} /></div></section><section className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Documents</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Count label="Devis" value={customer.documents?.quotes} /><Count label="Commandes" value={customer.documents?.proformas} /><Count label="Factures" value={customer.documents?.invoices} /><Count label="Fabrications" value={customer.documents?.manufacturing} /></div></section></div>
    {customer.history?.manufacturing?.length ? <section className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Fabrications</h2><div className="mt-4 space-y-2">{customer.history.manufacturing.map((order: any) => <Link key={order.id} href={`/dashboard/manufacturing/${order.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"><span><strong>{order.manufacturingNumber}</strong> · {order.title}</span><span className="text-slate-500">{order.status}{order.assignedTo?.name ? ` · ${order.assignedTo.name}` : ""}</span></Link>)}</div></section> : null}
    <section className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Notes</h2><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{customer.notes ?? "Aucune note."}</p></section>
  </div>;
}

function Metric({ label, value }: { label: string; value: unknown }) { return <div className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{String(value ?? 0)}</p></div>; }
function Count({ label, value }: { label: string; value: unknown }) { return <p className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">{label}: {String(value ?? 0)}</p>; }
function Details({ title, rows }: { title: string; rows: unknown[][] }) { return <section className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">{title}</h2><dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">{rows.map(([label, value]) => <div key={String(label)}><dt className="text-slate-500">{String(label)}</dt><dd>{String(value ?? "--")}</dd></div>)}</dl></section>; }

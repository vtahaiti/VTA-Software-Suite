"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001");
const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Commande",
  APPROVED: "Commande",
  PARTIALLY_RECEIVED: "Reçu partiel",
  FULLY_RECEIVED: "Reçu complet",
  RECEIVED: "Reçu complet",
  CANCELLED: "Annule"
};

type PurchaseOrder = {
  id: string;
  number: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  notes?: string;
  supplier?: { name: string };
  items: {
    id: string;
    quantity: number;
    receivedQty: number;
    unitCost: string;
    total: string;
    product?: { name: string; sku: string };
  }[];
  receipts: { id: string; number: string; createdAt: string; warehouse?: { name: string } }[];
};

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);

  const loadOrder = useCallback(async function loadOrder() {
    const response = await fetch(`${apiUrl}/purchase-orders/${params.id}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) setOrder(await response.json());
  }, [params.id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  async function action(name: "approve" | "cancel") {
    const response = await fetch(`${apiUrl}/purchase-orders/${params.id}/${name}`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) void loadOrder();
  }

  if (!order) return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">Chargement du bon de commande...</div>;

  const canReceive = ["SENT", "APPROVED", "PARTIALLY_RECEIVED"].includes(order.status);
  const canCancel = !["FULLY_RECEIVED", "RECEIVED", "CANCELLED"].includes(order.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600">{order.number}</p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{order.supplier?.name ?? "Fournisseur"}</h1>
          <p className="mt-1 text-sm text-slate-500">Statut : {statusLabels[order.status] ?? order.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === "DRAFT" ? <button onClick={() => action("approve")} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Marquer commande</button> : null}
          {canCancel ? <button onClick={() => action("cancel")} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">Annuler</button> : null}
          {canReceive ? <Link href="/dashboard/purchases/receipts" className="rounded-md border px-4 py-2 text-sm font-semibold">Réceptionner</Link> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Sous-total" value={order.subtotal} />
        <SummaryCard label="Taxe" value={order.tax} />
        <SummaryCard label="Total" value={order.total} />
        <SummaryCard label="Réceptions" value={String(order.receipts.length)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
            <tr>
              <th className="p-3">Produit</th>
              <th className="p-3">Commande</th>
              <th className="p-3">Reçu</th>
              <th className="p-3">Reste</th>
              <th className="p-3">Coût achat</th>
              <th className="p-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3">
                  <p className="font-medium">{item.product?.name}</p>
                  <p className="text-xs text-slate-500">{item.product?.sku}</p>
                </td>
                <td className="p-3">{item.quantity}</td>
                <td className="p-3">{item.receivedQty}</td>
                <td className="p-3">{Math.max(0, item.quantity - item.receivedQty)}</td>
                <td className="p-3">{item.unitCost}</td>
                <td className="p-3">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Historique des réceptions</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {order.receipts.map((receipt) => (
            <div key={receipt.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <p className="font-mono text-xs">{receipt.number}</p>
              <p className="font-medium">{receipt.warehouse?.name ?? "Entrepôt"}</p>
              <p className="text-sm text-slate-500">{new Date(receipt.createdAt).toLocaleDateString("fr-FR")}</p>
            </div>
          ))}
          {order.receipts.length === 0 ? <p className="text-sm text-slate-500">Aucune reception pour le moment.</p> : null}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

type OrderSummary = { id: string; number: string; supplier?: { name: string } };
type Warehouse = { id: string; name: string; code: string };
type OrderDetail = {
  id: string;
  items: {
    id: string;
    quantity: number;
    receivedQty: number;
    product?: { name: string; sku: string };
  }[];
};

export default function GoodsReceiptsPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [updateMissingCosts, setUpdateMissingCosts] = useState(true);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    if (purchaseOrderId) void loadOrder(purchaseOrderId);
    else {
      setOrder(null);
      setQuantities({});
    }
  }, [purchaseOrderId]);

  async function loadReferences() {
    const headers = { Authorization: `Bearer ${getAccessToken()}` };
    const [sent, approved, partial, warehousesResponse] = await Promise.all([
      fetch(`${apiUrl}/purchase-orders?status=SENT&limit=100`, { headers }),
      fetch(`${apiUrl}/purchase-orders?status=APPROVED&limit=100`, { headers }),
      fetch(`${apiUrl}/purchase-orders?status=PARTIALLY_RECEIVED&limit=100`, { headers }),
      fetch(`${apiUrl}/warehouses`, { headers })
    ]);
    const sentData = sent.ok ? await sent.json() : { items: [] };
    const approvedData = approved.ok ? await approved.json() : { items: [] };
    const partialData = partial.ok ? await partial.json() : { items: [] };
    const merged = [...(sentData.items ?? []), ...(approvedData.items ?? []), ...(partialData.items ?? [])];
    setOrders(merged.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index));
    if (warehousesResponse.ok) setWarehouses(await warehousesResponse.json());
  }

  async function loadOrder(id: string) {
    const response = await fetch(`${apiUrl}/purchase-orders/${id}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) {
      const data = await response.json();
      setOrder(data);
      setQuantities({});
    }
  }

  const receivableItems = useMemo(() => order?.items.filter((item) => item.receivedQty < item.quantity) ?? [], [order]);
  const receiptItems = useMemo(
    () => receivableItems
      .map((item) => ({ purchaseOrderItemId: item.id, quantity: Number(quantities[item.id] ?? 0) }))
      .filter((item) => item.quantity > 0),
    [receivableItems, quantities]
  );
  const canSubmit = Boolean(purchaseOrderId && warehouseId && receiptItems.length > 0 && !isSaving);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!canSubmit) {
      setMessage("Sélectionnéz un bon de commande, un entrepôt et au moins une quantite positive.");
      return;
    }
    setIsSaving(true);
    const response = await fetch(`${apiUrl}/goods-receipts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ purchaseOrderId, warehouseId, notes, updateMissingCosts, items: receiptItems })
    });
    setIsSaving(false);
    if (response.ok) {
      setMessage("Réception enregistrée et stock mis à jour.");
      setNotes("");
      await loadReferences();
      await loadOrder(purchaseOrderId);
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Réception impossible");
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Achats</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Réception marchandises</h1>
        <p className="mt-1 text-sm text-slate-500">Les quantités réceptionnées augmentent le stock des produits du bon d&apos;achat.</p>
        {message ? <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <select required value={purchaseOrderId} onChange={(event) => setPurchaseOrderId(event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Bon de commande</option>
            {orders.map((item) => <option key={item.id} value={item.id}>{item.number} - {item.supplier?.name ?? "Fournisseur"}</option>)}
          </select>
          <select required value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Entrepôt</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}
          </select>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={updateMissingCosts} onChange={(event) => setUpdateMissingCosts(event.target.checked)} className="mt-1" />
          Mettre à jour le coût d&apos;achat seulement pour les produits sans coût enregistré.
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Articles à réceptionner</h2>
        <div className="mt-4 space-y-3">
          {receivableItems.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[1fr_120px_120px_160px]">
              <div>
                <p className="font-medium">{item.product?.name}</p>
                <p className="text-xs text-slate-500">{item.product?.sku}</p>
              </div>
              <p className="text-sm">Commandé : {item.quantity}</p>
              <p className="text-sm">Reçu : {item.receivedQty}</p>
              <input type="number" min="0" max={item.quantity - item.receivedQty} value={quantities[item.id] ?? 0} onChange={(event) => setQuantities({ ...quantities, [item.id]: Number(event.target.value) })} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </div>
          ))}
          {purchaseOrderId && receivableItems.length === 0 ? <p className="text-sm text-slate-500">Toutes les lignes sont déjà réceptionnées.</p> : null}
          {!purchaseOrderId ? <p className="text-sm text-slate-500">Sélectionnez un bon de commande non reçu ou partiellement reçu.</p> : null}
        </div>
        <div className="mt-5 flex justify-end">
          <button disabled={!canSubmit} className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Enregistrement..." : "Enregistrer la réception"}</button>
        </div>
      </div>
    </form>
  );
}

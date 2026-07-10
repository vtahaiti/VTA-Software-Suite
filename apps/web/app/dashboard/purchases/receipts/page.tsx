"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type OrderSummary = { id: string; number: string; supplier?: { name: string } };
type Warehouse = { id: string; name: string; code: string };
type OrderDetail = { id: string; items: { id: string; quantity: number; receivedQty: number; product?: { name: string; sku: string } }[] };

export default function GoodsReceiptsPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { loadRéférences(); }, []);
  useEffect(() => { if (purchaseOrderId) loadOrder(purchaseOrderId); else setOrder(null); }, [purchaseOrderId]);

  async function loadRéférences() {
    const headers = { Authorization: `Bearer ${getAccessToken()}` };
    const [approved, partial, warehousesResponse] = await Promise.all([
      fetch(`${apiUrl}/purchase-orders?status=APPROVED&limit=100`, { headers }),
      fetch(`${apiUrl}/purchase-orders?status=PARTIALLY_RECEIVED&limit=100`, { headers }),
      fetch(`${apiUrl}/warehouses`, { headers })
    ]);
    const approvedData = approved.ok ? await approved.json() : { items: [] };
    const partialData = partial.ok ? await partial.json() : { items: [] };
    setOrders([...(approvedData.items ?? []), ...(partialData.items ?? [])]);
    if (warehousesResponse.ok) setWarehouses(await warehousesResponse.json());
  }

  async function loadOrder(id: string) {
    const response = await fetch(`${apiUrl}/purchase-orders/${id}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) { const data = await response.json(); setOrder(data); setQuantities({}); }
  }

  const receivableItems = useMemo(() => order?.items.filter((item) => item.receivedQty < item.quantity) ?? [], [order]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const items = receivableItems.map((item) => ({ purchaseOrderItemId: item.id, quantity: Number(quantities[item.id] ?? 0) })).filter((item) => item.quantity > 0);
    const response = await fetch(`${apiUrl}/goods-receipts`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify({ purchaseOrderId, warehouseId, notes, items }) });
    if (response.ok) { setMessage("Réception enregistrée et stock préparé."); setNotes(""); await loadRéférences(); await loadOrder(purchaseOrderId); return; }
    const body = await response.json().catch(() => null);
    setMessage(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Réception impossible");
  }

  return <form onSubmit={submit} className="space-y-5"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Achats</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Réception marchandises</h1><p className="mt-1 text-sm text-slate-500">Les quantités réceptionnées alimentent le stock via le service inventaire.</p>{message && <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p>}<div className="mt-5 grid gap-3 md:grid-cols-3"><select required value={purchaseOrderId} onChange={(e)=>setPurchaseOrderId(e.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Bon de commande</option>{orders.map((item)=><option key={item.id} value={item.id}>{item.number} - {item.supplier?.name ?? "Fournisseur"}</option>)}</select><select required value={warehouseId} onChange={(e)=>setWarehouseId(e.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Entrepôt</option>{warehouses.map((warehouse)=><option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}</select><input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Notes" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/></div></div><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Articles a receptionner</h2><div className="mt-4 space-y-3">{receivableItems.map((item)=><div key={item.id} className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[1fr_120px_120px_160px]"><div><p className="font-medium">{item.product?.name}</p><p className="text-xs text-slate-500">{item.product?.sku}</p></div><p className="text-sm">Commande: {item.quantity}</p><p className="text-sm">Reçu: {item.receivedQty}</p><input type="number" min="0" max={item.quantity - item.receivedQty} value={quantities[item.id] ?? 0} onChange={(e)=>setQuantities({...quantities,[item.id]:Number(e.target.value)})} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/></div>)}{purchaseOrderId && receivableItems.length === 0 && <p className="text-sm text-slate-500">Toutes les lignes sont déjà réceptionnées.</p>}{!purchaseOrderId && <p className="text-sm text-slate-500">Sélectionnez un bon de commande valide ou partiellement reçu.</p>}</div><div className="mt-5 flex justify-end"><button className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white">Enregistrer la reception</button></div></div></form>;
}

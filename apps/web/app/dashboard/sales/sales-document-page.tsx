"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { downloadPdf, openPrintPreview } from "@/lib/print";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const statusLabels: Record<string, string> = { DRAFT: "Brouillon", SENT: "Envoye", ACCEPTED: "Accepte", REJECTED: "Refuse", PAID: "Paye", PARTIALLY_PAID: "Partiellement paye", CANCELLED: "Annule" };
type DocType = "quotes" | "proformas" | "invoices";
type Customer = { id: string; name?: string; displayName?: string };
type Product = { id: string; sku: string; name: string; salePrice?: string };
type DocumentItem = { id: string; quantity: number; unitPrice: string; discount: string; tax: string; total: string; product?: Product };
type SalesDocument = { id: string; number: string; status: string; subtotal: string; discount: string; tax: string; total: string; balance: string; notes?: string; createdAt: string; customer?: Customer; items: DocumentItem[] };
type Line = { productId: string; quantity: number; unitPrice: number; discount: number; tax: number };

type Props = { type: DocType; title: string; eyebrow: string; createLabel: string; transformLabel?: string; transformAction?: string };

export function SalesDocumentPage({ type, title, eyebrow, createLabel, transformLabel, transformAction }: Props) {
  const [items, setItems] = useState<SalesDocument[]>([]);
  const [selected, setSelected] = useState<SalesDocument | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 }]);
  const [message, setMessage] = useState("");

  useEffect(() => { loadReferences(); }, []);
  useEffect(() => { const timer = setTimeout(() => loadDocuments(), 250); return () => clearTimeout(timer); }, [search, status, type]);

  async function loadReferences() {
    const headers = { Authorization: `Bearer ${getAccessToken()}` };
    const [customersResponse, productsResponse] = await Promise.all([fetch(`${apiUrl}/customers?limit=100`, { headers }), fetch(`${apiUrl}/products?limit=100`, { headers })]);
    if (customersResponse.ok) { const data = await customersResponse.json(); setCustomers(data.items ?? []); }
    if (productsResponse.ok) { const data = await productsResponse.json(); setProducts(data.items ?? []); }
  }

  async function loadDocuments() {
    const params = new URLSearchParams({ limit: "20" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const response = await fetch(`${apiUrl}/${type}?${params}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) { const data = await response.json(); setItems(data.items ?? []); }
  }

  function updateLine(index: number, values: Partial<Line>) { setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...values } : line)); }
  function selectProduct(index: number, productId: string) { const product = products.find((item) => item.id === productId); updateLine(index, { productId, unitPrice: Number(product?.salePrice ?? 0) }); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(`${apiUrl}/${type}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify({ customerId: customerId || undefined, discount, notes, items: lines }) });
    if (response.ok) { const doc = await response.json(); setSelected(doc); setMessage("Document cree avec succes."); setLines([{ productId: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 }]); setNotes(""); setDiscount(0); await loadDocuments(); return; }
    const body = await response.json().catch(() => null);
    setMessage(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Action impossible");
  }

  async function runAction(document: SalesDocument, action: string) {
    const response = await fetch(`${apiUrl}/${type}/${document.id}/${action}`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) { setMessage("Action executee."); const data = await response.json(); setSelected(data.items ? data : { ...document, status: data.status ?? document.status }); await loadDocuments(); }
  }

  const totalPreview = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount + line.tax, 0) - discount, [lines, discount]);

  return <div className="space-y-5"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">{eyebrow}</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1><p className="mt-1 text-sm text-slate-500">Recherche, filtres, detail document et impression prepares.</p>{message && <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p>}</div><div className="grid gap-5 xl:grid-cols-[420px_1fr]"><form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">{createLabel}</h2><div className="mt-4 space-y-3"><select value={customerId} onChange={(event)=>setCustomerId(event.target.value)} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Client</option>{customers.map((customer)=><option key={customer.id} value={customer.id}>{customer.displayName ?? customer.name}</option>)}</select><input value={notes} onChange={(event)=>setNotes(event.target.value)} placeholder="Notes" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><input type="number" min="0" step="0.01" value={discount} onChange={(event)=>setDiscount(Number(event.target.value))} placeholder="Remise globale" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/></div><div className="mt-4 space-y-3">{lines.map((line,index)=><div key={index} className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800"><select required value={line.productId} onChange={(event)=>selectProduct(index,event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Produit</option>{products.map((product)=><option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select><div className="grid grid-cols-4 gap-2"><input type="number" min="1" value={line.quantity} onChange={(event)=>updateLine(index,{quantity:Number(event.target.value)})} className="rounded-md border px-2 py-2 dark:border-slate-700 dark:bg-slate-950"/><input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event)=>updateLine(index,{unitPrice:Number(event.target.value)})} className="rounded-md border px-2 py-2 dark:border-slate-700 dark:bg-slate-950"/><input type="number" min="0" step="0.01" value={line.discount} onChange={(event)=>updateLine(index,{discount:Number(event.target.value)})} className="rounded-md border px-2 py-2 dark:border-slate-700 dark:bg-slate-950"/><input type="number" min="0" step="0.01" value={line.tax} onChange={(event)=>updateLine(index,{tax:Number(event.target.value)})} className="rounded-md border px-2 py-2 dark:border-slate-700 dark:bg-slate-950"/></div></div>)}</div><div className="mt-4 flex items-center justify-between"><button type="button" onClick={()=>setLines([...lines,{productId:"",quantity:1,unitPrice:0,discount:0,tax:0}])} className="rounded-md border px-3 py-2 text-sm">Ajouter ligne</button><p className="text-sm font-semibold">Total: {totalPreview.toFixed(2)}</p></div><button className="mt-4 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button></form><section className="space-y-4"><div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2"><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Recherche" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><select value={status} onChange={(event)=>setStatus(event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Tous les statuts</option><option value="DRAFT">Brouillon</option><option value="SENT">Envoye</option><option value="ACCEPTED">Accepte</option><option value="REJECTED">Refuse</option><option value="PAID">Paye</option><option value="PARTIALLY_PAID">Partiellement paye</option><option value="CANCELLED">Annule</option></select></div><div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Numero</th><th className="p-3">Client</th><th className="p-3">Total</th><th className="p-3">Solde</th><th className="p-3">Statut</th><th className="p-3">Action</th></tr></thead><tbody>{items.map((doc)=><tr key={doc.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-mono text-xs">{doc.number}</td><td className="p-3">{doc.customer?.displayName ?? doc.customer?.name ?? "--"}</td><td className="p-3">{doc.total}</td><td className="p-3">{doc.balance}</td><td className="p-3">{statusLabels[doc.status] ?? doc.status}</td><td className="p-3"><div className="flex flex-wrap gap-2"><button onClick={()=>setSelected(doc)} className="text-brand-600">Detail</button>{type==="invoices"&&<button onClick={()=>void openPrintPreview(`/invoices/${doc.id}/print`)} className="text-slate-600">Imprimer</button>}{type==="invoices"&&<button onClick={()=>void downloadPdf(`/invoices/${doc.id}/pdf`,`facture-${doc.number}.pdf`)} className="text-slate-600">PDF</button>}</div></td></tr>)}</tbody></table></div>{selected && <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="font-mono text-xs text-slate-500">{selected.number}</p><h2 className="text-lg font-semibold">Detail document</h2><p className="text-sm text-slate-500">Client: {selected.customer?.displayName ?? selected.customer?.name ?? "--"}</p></div><div className="flex flex-wrap gap-2">{type==="invoices"?<><button onClick={()=>void openPrintPreview(`/invoices/${selected.id}/print`)} className="rounded-md border px-3 py-2 text-sm">Apercu avant impression</button><button onClick={()=>void openPrintPreview(`/invoices/${selected.id}/print`)} className="rounded-md border px-3 py-2 text-sm">Imprimer facture</button><button onClick={()=>void downloadPdf(`/invoices/${selected.id}/pdf`,`facture-${selected.number}.pdf`)} className="rounded-md border px-3 py-2 text-sm">Telecharger PDF</button></>:<button onClick={()=>window.print()} className="rounded-md border px-3 py-2 text-sm">Imprimer</button>}{type==="quotes" && <button onClick={()=>runAction(selected,"send")} className="rounded-md border px-3 py-2 text-sm">Envoyer</button>}{type==="quotes" && <button onClick={()=>runAction(selected,"accept")} className="rounded-md border px-3 py-2 text-sm">Accepter</button>}{transformAction && <button onClick={()=>runAction(selected,transformAction)} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white">{transformLabel}</button>}{type==="invoices" && <button onClick={()=>runAction(selected,"cancel")} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700">Annuler</button>}</div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="text-slate-500"><th className="p-2">Produit</th><th className="p-2">Qte</th><th className="p-2">Prix</th><th className="p-2">Remise</th><th className="p-2">Taxe</th><th className="p-2">Total</th></tr></thead><tbody>{selected.items.map((item)=><tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2">{item.product?.name}</td><td className="p-2">{item.quantity}</td><td className="p-2">{item.unitPrice}</td><td className="p-2">{item.discount}</td><td className="p-2">{item.tax}</td><td className="p-2">{item.total}</td></tr>)}</tbody></table></div></div>}</section></div></div>;
}
"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";
import { getCompanyBranding, type CompanyBranding } from "@/lib/company-branding";
import { getAccessToken } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; purchasePrice?: string | number; averageCost?: string | number; unit?: { name?: string; symbol?: string } | null };
type Assignee = { id: string; name: string; email: string };
type Item = { id: string; description: string; quantity: string | number; width?: string | number | null; height?: string | number | null; length?: string | number | null; dimensionUnit: string; workType?: string | null; material?: string | null; color?: string | null; glassType?: string | null; instructions?: string | null };
type Material = { id: string; productId: string; requiredQuantity: string | number; reservedQuantity: string | number; consumedQuantity: string | number; wasteQuantity: string | number; unit: string; unitCost: string | number; notes?: string | null; availableQuantity?: number; product: Product };
type Order = { id: string; manufacturingNumber: string; title: string; status: string; priority: string; expectedDate?: string | null; startedAt?: string | null; createdAt: string; instructions?: string | null; notes?: string | null; warehouse: { id: string; name: string; code: string }; customer?: { displayName?: string; phone?: string | null; mobile?: string | null } | null; assignedTo?: Assignee | null; items: Item[]; materials: Material[]; proforma: { id: string; documentNumber: string; total: string | number; paidAmount: string | number; balance: string | number; paymentStatus: string } };

const statusLabels: Record<string, string> = { DRAFT: "Brouillon", TO_PREPARE: "À préparer", IN_PRODUCTION: "En fabrication", READY: "Prête", COMPLETED: "Terminée", CANCELLED: "Annulée" };

export default function ManufacturingDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [material, setMaterial] = useState({ productId: "", requiredQuantity: "", unit: "", notes: "" });
  const [edit, setEdit] = useState({ assignedToId: "", priority: "NORMAL", expectedDate: "", instructions: "", notes: "" });

  const load = useCallback(async () => {
    setError("");
    try {
      const [orderResponse, productResponse, assigneeResponse] = await Promise.all([
        fetchWithAuth(`${apiUrl}/manufacturing/${params.id}`),
        fetchWithAuth(`${apiUrl}/products?limit=100`),
        fetchWithAuth(`${apiUrl}/manufacturing/assignees`)
      ]);
      if (!orderResponse.ok) throw new Error(await responseMessage(orderResponse, "Fabrication introuvable."));
      const next: Order = await orderResponse.json();
      setOrder(next);
      setEdit({ assignedToId: next.assignedTo?.id ?? "", priority: next.priority, expectedDate: next.expectedDate ? next.expectedDate.slice(0, 10) : "", instructions: next.instructions ?? "", notes: next.notes ?? "" });
      if (productResponse.ok) setProducts((await productResponse.json()).items ?? []);
      if (assigneeResponse.ok) setAssignees(await assigneeResponse.json());
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Impossible de charger la fabrication."); }
  }, [params.id]);

  useEffect(() => { void load(); const token = getAccessToken(); if (token) void getCompanyBranding(token).then(setBranding).catch(() => null); }, [load]);

  async function action(path: string, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetchWithAuth(`${apiUrl}/manufacturing/${params.id}/${path}`, { method: "POST" });
      if (!response.ok) throw new Error(await responseMessage(response, "Action impossible."));
      setOrder(await response.json());
      setMessage(path === "reserve" ? "Matières réservées." : path === "start" ? "Fabrication lancée. Les matières ont été consommées une seule fois." : path === "ready" ? "Fabrication marquée prête." : "Fabrication annulée.");
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Action impossible."); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetchWithAuth(`${apiUrl}/manufacturing/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...edit, assignedToId: edit.assignedToId || undefined, expectedDate: edit.expectedDate || undefined }) });
    if (response.ok) { setOrder(await response.json()); setMessage("Fiche atelier enregistrée."); } else setError(await responseMessage(response, "Enregistrement impossible."));
    setBusy(false);
  }

  async function addMaterial(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const selected = products.find((product) => product.id === material.productId);
    const response = await fetchWithAuth(`${apiUrl}/manufacturing/${params.id}/materials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: material.productId, requiredQuantity: Number(material.requiredQuantity), unit: material.unit || selected?.unit?.symbol || selected?.unit?.name || undefined, notes: material.notes || undefined }) });
    if (response.ok) { setOrder(await response.json()); setMaterial({ productId: "", requiredQuantity: "", unit: "", notes: "" }); setMessage("Matière ajoutée."); } else setError(await responseMessage(response, "Impossible d'ajouter la matière."));
    setBusy(false);
  }

  async function removeMaterial(materialId: string) {
    if (!window.confirm("Retirer cette matière de la fabrication ?")) return;
    const response = await fetchWithAuth(`${apiUrl}/manufacturing/${params.id}/materials/${materialId}`, { method: "DELETE" });
    if (response.ok) setOrder(await response.json()); else setError(await responseMessage(response, "Suppression impossible."));
  }

  async function print() { if (document.fonts?.ready) await document.fonts.ready; window.print(); }
  if (!order) return <div className="rounded-lg border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">{error || "Chargement..."}</div>;
  const editableMaterials = ["DRAFT", "TO_PREPARE"].includes(order.status);

  return <div className="space-y-5">
    <section className="rounded-lg border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-semibold text-brand-600">Bon de fabrication</p><h1 className="text-2xl font-bold">{order.manufacturingNumber}</h1><p className="mt-1 text-sm text-slate-500">{order.title}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void print()} className="rounded-md border px-4 py-2 text-sm font-semibold">Imprimer bon de fabrication</button><Link href={`/dashboard/sales/proformas/${order.proforma.id}`} className="rounded-md border px-4 py-2 text-sm">Voir la commande</Link><Link href="/dashboard/manufacturing" className="rounded-md border px-4 py-2 text-sm">Retour</Link></div></div></section>
    {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 print:hidden">{message}</p> : null}{error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</p> : null}
    <section className="printable-document rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:border-0 print:p-0">
      <PrintHeader branding={branding} order={order}/>
      <div className="grid gap-3 border-b py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4"><Info label="Client" value={order.customer?.displayName ?? "Client comptoir"}/><Info label="Téléphone" value={order.customer?.phone ?? order.customer?.mobile ?? "--"}/><Info label="Dépôt" value={`${order.warehouse.code} — ${order.warehouse.name}`}/><Info label="Statut" value={statusLabels[order.status] ?? order.status}/><Info label="Date commande" value={date(order.createdAt)}/><Info label="Date prévue" value={date(order.expectedDate)}/><Info label="Responsable" value={order.assignedTo?.name ?? "Non affecté"}/><Info label="Priorité" value={priority(order.priority)}/></div>
      <h2 className="mt-5 text-lg font-bold">Ouvrages</h2><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm print:min-w-0"><thead className="bg-slate-50 print:bg-white"><tr><th className="p-2">Article</th><th className="p-2">Qté</th><th className="p-2">Dimensions</th><th className="p-2">Matériau</th><th className="p-2">Couleur</th><th className="p-2">Verre</th><th className="p-2">Instructions</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id} className="border-t"><td className="p-2 font-semibold">{item.description}</td><td className="p-2">{num(item.quantity)}</td><td className="p-2">{dimensions(item)}</td><td className="p-2">{item.material ?? "--"}</td><td className="p-2">{item.color ?? "--"}</td><td className="p-2">{item.glassType ?? "--"}</td><td className="p-2 text-xs">{item.instructions ?? "--"}</td></tr>)}</tbody></table></div>
      <h2 className="mt-6 text-lg font-bold">Matières nécessaires</h2><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm print:min-w-0"><thead className="bg-slate-50 print:bg-white"><tr><th className="p-2">Matière</th><th className="p-2">Nécessaire</th><th className="p-2">Disponible</th><th className="p-2">Réservé</th><th className="p-2">Consommé</th><th className="p-2 print:hidden"></th></tr></thead><tbody>{order.materials.map((row) => <tr key={row.id} className="border-t"><td className="p-2 font-semibold">{row.product.name}</td><td className="p-2">{num(row.requiredQuantity)} {row.unit}</td><td className="p-2">{row.availableQuantity ?? "--"} {row.unit}</td><td className="p-2">{num(row.reservedQuantity)} {row.unit}</td><td className="p-2">{num(row.consumedQuantity)} {row.unit}</td><td className="p-2 print:hidden">{editableMaterials ? <button onClick={() => void removeMaterial(row.id)} className="text-xs font-semibold text-red-600">Retirer</button> : null}</td></tr>)}{!order.materials.length ? <tr><td colSpan={6} className="p-4 text-center text-slate-500">Aucune matière ajoutée.</td></tr> : null}</tbody></table></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 print:grid-cols-1"><div><h2 className="font-bold">Instructions atelier</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{order.instructions || "Aucune instruction."}</p></div><div className="print:hidden"><h2 className="font-bold">Résumé commande</h2><div className="mt-2 grid grid-cols-3 gap-2"><Mini label="Total" value={money(order.proforma.total)}/><Mini label="Avance" value={money(order.proforma.paidAmount)}/><Mini label="Balance" value={money(order.proforma.balance)}/></div></div></div>
      <div className="mt-12 hidden grid-cols-4 gap-8 text-xs print:grid"><span className="border-t pt-2">Préparé par</span><span className="border-t pt-2">Fabricant</span><span className="border-t pt-2">Contrôle</span><span className="border-t pt-2">Date</span></div>
    </section>
    <form onSubmit={save} className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:hidden"><h2 className="font-bold">Organisation atelier</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><select value={edit.assignedToId} onChange={(event) => setEdit({ ...edit, assignedToId: event.target.value })} className="rounded-md border px-3 py-2 dark:bg-slate-950"><option value="">Responsable non affecté</option>{assignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><select value={edit.priority} onChange={(event) => setEdit({ ...edit, priority: event.target.value })} className="rounded-md border px-3 py-2 dark:bg-slate-950"><option value="NORMAL">Priorité normale</option><option value="HIGH">Priorité haute</option><option value="URGENT">Urgente</option></select><input type="date" value={edit.expectedDate} onChange={(event) => setEdit({ ...edit, expectedDate: event.target.value })} className="rounded-md border px-3 py-2 dark:bg-slate-950"/></div><textarea value={edit.instructions} onChange={(event) => setEdit({ ...edit, instructions: event.target.value })} placeholder="Instructions atelier" className="mt-3 min-h-24 w-full rounded-md border px-3 py-2 dark:bg-slate-950"/><button disabled={busy} className="mt-3 rounded-md border px-4 py-2 text-sm font-semibold">Enregistrer la fiche</button></form>
    {editableMaterials ? <form onSubmit={addMaterial} className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:hidden"><h2 className="font-bold">Ajouter une matière</h2><div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_2fr]"><select required value={material.productId} onChange={(event) => setMaterial({ ...material, productId: event.target.value })} className="rounded-md border px-3 py-2 dark:bg-slate-950"><option value="">Choisir une matière</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.sku}</option>)}</select><input required type="number" min="0.001" step="0.001" value={material.requiredQuantity} onChange={(event) => setMaterial({ ...material, requiredQuantity: event.target.value })} placeholder="Quantité" className="rounded-md border px-3 py-2 dark:bg-slate-950"/><input value={material.unit} onChange={(event) => setMaterial({ ...material, unit: event.target.value })} placeholder="Unité" className="rounded-md border px-3 py-2 dark:bg-slate-950"/><input value={material.notes} onChange={(event) => setMaterial({ ...material, notes: event.target.value })} placeholder="Note facultative" className="rounded-md border px-3 py-2 dark:bg-slate-950"/></div><button disabled={busy} className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Ajouter matière</button></form> : null}
    <section className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:hidden"><h2 className="font-bold">Avancement</h2><div className="mt-3 flex flex-wrap gap-2">{editableMaterials ? <button disabled={busy} onClick={() => void action("reserve")} className="rounded-md border px-4 py-2 text-sm font-semibold">Réserver les matières</button> : null}{order.status === "TO_PREPARE" ? <button disabled={busy} onClick={() => void action("start", "Lancer la fabrication et consommer les matières réservées ?")} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Lancer la fabrication</button> : null}{order.status === "IN_PRODUCTION" ? <button disabled={busy} onClick={() => void action("ready")} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Fabrication prête</button> : null}{editableMaterials ? <button disabled={busy} onClick={() => void action("cancel", "Annuler cette fabrication et libérer les matières réservées ?")} className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Annuler</button> : null}{order.status === "READY" ? <Link href={`/dashboard/sales/proformas/${order.proforma.id}`} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Passer à la livraison / installation</Link> : null}</div></section>
  </div>;
}

function PrintHeader({ branding, order }: { branding: CompanyBranding | null; order: Order }) { return <div className="flex items-start justify-between gap-4 border-b pb-4"><div className="flex items-center gap-3">{branding?.logoUrl ? <img src={branding.logoUrl} alt="" className="h-14 w-14 object-contain"/> : <div className="flex h-14 w-14 items-center justify-center rounded bg-slate-900 font-bold text-white">{branding?.companyInitials ?? "SW"}</div>}<div><p className="text-xl font-black">{branding?.companyName ?? "SHALOM WINDOWS"}</p><p className="text-xs text-slate-500">{branding?.phone ?? ""}</p></div></div><div className="text-right"><p className="text-xl font-black uppercase">Bon de fabrication</p><p className="font-mono text-sm">{order.manufacturingNumber}</p><p className="text-xs text-slate-500">{order.title}</p></div></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold">{value}</p></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded border p-2"><p className="text-xs text-slate-500">{label}</p><p className="font-bold">{value}</p></div>; }
function dimensions(item: Item) { const values = [item.width, item.height, item.length].filter((value): value is string | number => value !== null && value !== undefined && value !== "").map(num); return values.length ? `${values.join(" × ")} ${item.dimensionUnit}` : "--"; }
function num(value: string | number) { return Number(value).toLocaleString("fr-HT", { maximumFractionDigits: 3 }); }
function money(value: string | number) { return `${Number(value).toLocaleString("fr-HT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HTG`; }
function date(value?: string | null) { return value ? new Date(value).toLocaleDateString("fr-HT") : "Non définie"; }
function priority(value: string) { return value === "URGENT" ? "Urgente" : value === "HIGH" ? "Haute" : "Normale"; }
async function responseMessage(response: Response, fallback: string) { const body = await response.json().catch(() => null); return Array.isArray(body?.message) ? body.message[0] : body?.message ?? fallback; }

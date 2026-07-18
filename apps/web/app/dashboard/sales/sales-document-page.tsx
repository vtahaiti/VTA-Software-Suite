"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { getTenantBusinessConfiguration } from "@/lib/business-profiles";
import { downloadPdf, openPrintPreview } from "@/lib/print";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

const statusLabels: Record<string, string> = {
  DRAFT: "Devis",
  SENT: "Envoye",
  ACCEPTED: "Accepte",
  CONFIRMED: "Confirmee",
  IN_PROGRESS: "En cours / En fabrication",
  READY: "Prete pour livraison/installation",
  DELIVERED: "Livree",
  COMPLETED: "Terminee",
  REJECTED: "Refuse",
  CONVERTED: "Transforme",
  PAID: "Soldee",
  PARTIALLY_PAID: "Acompte recu",
  CANCELLED: "Annulee",
  RETURNED: "Retournee"
};

const orderStatuses = ["CONFIRMED", "IN_PROGRESS", "READY", "DELIVERED", "COMPLETED", "CANCELLED"];

type DocType = "quotes" | "proformas" | "invoices";
type Customer = { id: string; name?: string; displayName?: string };
type Product = { id: string; sku: string; name: string; salePrice?: string; unit?: string };
type Payment = { id: string; method: string; amount: string; reference?: string; notes?: string; createdAt: string };
type DocumentItem = {
  id: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
  customName?: string;
  customType?: string;
  customNote?: string;
  product?: Product;
};
type SalesDocument = {
  id: string;
  number: string;
  status: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paidAmount: string;
  balance: string;
  notes?: string;
  createdAt: string;
  customer?: Customer;
  items: DocumentItem[];
  payments?: Payment[];
};
type Line = {
  productId: string;
  customName: string;
  customType: string;
  material: string;
  width: string;
  height: string;
  color: string;
  thickness: string;
  length: string;
  measurementNotes: string;
  installationDate: string;
  installationNotes: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
};
type Summary = { ordersInProgress: number; depositsReceived: number; balancesToCollect: number; readyUnpaidOrders: number; completedOrders: number };

type Props = { type: DocType; title: string; eyebrow: string; createLabel: string; transformLabel?: string; transformAction?: string };

function money(value: string | number | undefined) {
  return Number(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function documentKind(type: DocType) {
  if (type === "quotes") return "Devis";
  if (type === "proformas") return "Commande";
  return "Facture";
}

function documentHelpText(type: DocType) {
  if (type === "quotes") return "Devis = proposition de prix. Il ne modifie pas le stock tant qu'il n'est pas converti en commande ou vente.";
  if (type === "proformas") return "Commande = vente confirmee qui peut recevoir un acompte puis un solde.";
  return "Facture = document de vente finalise ou a encaisser selon le statut.";
}

const fabricationTypes = ["Fenetre", "Porte", "Cadre", "Vitrine", "Moustiquaire", "Structure simple", "Autre"];
const fabricationMaterials = ["Aluminium", "Bois", "PVC", "Metal", "Verre", "Autre"];

function newLine(): Line {
  return { productId: "", customName: "", customType: "SERVICE", material: "", width: "", height: "", color: "", thickness: "", length: "", measurementNotes: "", installationDate: "", installationNotes: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 };
}

function isFabricationProfile(profileType?: string, primaryActivity?: string) {
  const source = `${profileType ?? ""} ${primaryActivity ?? ""}`.toLowerCase();
  return source.includes("windows-aluminium") || source.includes("manufacturing") || source.includes("fabrication") || source.includes("aluminium") || source.includes("fenetre") || source.includes("fenetre") || source.includes("porte");
}

function composeFabricationNote(line: Line) {
  const details = [
    line.material ? `Materiau: ${line.material}` : "",
    line.width ? `Largeur: ${line.width}` : "",
    line.height ? `Hauteur: ${line.height}` : "",
    line.length ? `Longueur: ${line.length}` : "",
    line.color ? `Couleur: ${line.color}` : "",
    line.thickness ? `Epaisseur / verre: ${line.thickness}` : "",
    line.installationDate ? `Date prevue: ${line.installationDate}` : "",
    line.installationNotes ? `Livraison / installation: ${line.installationNotes}` : "",
    line.measurementNotes ? `Notes de mesure: ${line.measurementNotes}` : ""
  ].filter(Boolean);
  return details.length ? details.join("\n") : undefined;
}

export function SalesDocumentPage({ type, title, eyebrow, createLabel, transformLabel, transformAction }: Props) {
  const [items, setItems] = useState<SalesDocument[]>([]);
  const [selected, setSelected] = useState<SalesDocument | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [message, setMessage] = useState("");
  const [showFabricationFields, setShowFabricationFields] = useState(false);

  const apiFetch = useCallback(async (path: string, init?: RequestInit) => {
    return fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}`, ...(init?.headers ?? {}) }
    });
  }, []);

  const loadDocuments = useCallback(async () => {
    const params = new URLSearchParams({ limit: "20" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const response = await apiFetch(`/${type}?${params}`);
    if (response.ok) setItems((await response.json()).items ?? []);
    if (type === "proformas") {
      const summaryResponse = await apiFetch("/proformas/reports/summary");
      if (summaryResponse.ok) setSummary(await summaryResponse.json());
    }
  }, [apiFetch, search, status, type]);

  useEffect(() => { void loadReferences(); }, []);
  useEffect(() => { const timer = setTimeout(() => void loadDocuments(), 250); return () => clearTimeout(timer); }, [loadDocuments]);

  async function loadReferences() {
    const headers = { Authorization: `Bearer ${getAccessToken()}` };
    const [customersResponse, productsResponse, tenantConfiguration] = await Promise.all([
      fetch(`${apiUrl}/customers?limit=100`, { headers }),
      fetch(`${apiUrl}/products?limit=100`, { headers }),
      getTenantBusinessConfiguration().catch(() => null)
    ]);
    if (customersResponse.ok) setCustomers((await customersResponse.json()).items ?? []);
    if (productsResponse.ok) setProducts((await productsResponse.json()).items ?? []);
    setShowFabricationFields(isFabricationProfile(tenantConfiguration?.businessProfileType, tenantConfiguration?.primaryActivity));
  }

  async function refreshSelected(id: string) {
    const response = await apiFetch(`/${type}/${id}`);
    if (response.ok) setSelected(await response.json());
  }

  function updateLine(index: number, values: Partial<Line>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...values } : line));
  }

function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(index, { productId, customName: "", customType: "SERVICE", material: "", width: "", height: "", color: "", thickness: "", length: "", measurementNotes: "", installationDate: "", installationNotes: "", unitPrice: Number(product?.salePrice ?? 0) });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const payload = {
      customerId: customerId || undefined,
      discount,
      notes,
      items: lines.map((line) => ({
        productId: line.productId || undefined,
        customName: line.productId ? undefined : line.customName,
        customType: line.productId ? undefined : line.customType || "SERVICE",
        customNote: line.productId ? undefined : composeFabricationNote(line),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        tax: line.tax
      }))
    };
    const response = await apiFetch(`/${type}`, { method: "POST", body: JSON.stringify(payload) });
    if (response.ok) {
      const doc = await response.json();
      setSelected(doc);
      setMessage(`${documentKind(type)} enregistre.`);
      setLines([newLine()]);
      setNotes("");
      setDiscount(0);
      await loadDocuments();
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Action impossible");
  }

  async function runAction(document: SalesDocument, action: string) {
    const response = await apiFetch(`/${type}/${document.id}/${action}`, { method: "POST" });
    if (response.ok) {
      setMessage("Action executee.");
      await refreshSelected(document.id);
      await loadDocuments();
    }
  }

  async function updateStatus(document: SalesDocument, nextStatus: string) {
    const response = await apiFetch(`/proformas/${document.id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
    if (response.ok) {
      setMessage("Statut mis a jour.");
      await refreshSelected(document.id);
      await loadDocuments();
    }
  }

  async function registerPayment(document: SalesDocument) {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setMessage("Montant d'acompte invalide.");
      return;
    }
    const response = await apiFetch(`/${type}/${document.id}/payments`, {
      method: "POST",
      body: JSON.stringify({ method: "CASH", amount, reference: paymentReference || undefined, notes: "Acompte / paiement partiel" })
    });
    if (response.ok) {
      setMessage("Paiement enregistre.");
      setPaymentAmount("");
      setPaymentReference("");
      await refreshSelected(document.id);
      await loadDocuments();
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(body?.message ?? "Paiement impossible.");
  }

  function printSelected() {
    window.print();
  }

  const totalPreview = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount + line.tax, 0) - discount, [lines, discount]);
  const canTakePayment = selected && (type === "proformas" || type === "invoices") && Number(selected.balance) > 0 && selected.status !== "CANCELLED";
  const compactProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const filtered = term ? products.filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(term)) : products;
    return filtered.slice(0, 25);
  }, [productSearch, products]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Devis, commandes, acomptes, soldes et impression simple.</p>
        <div className="mt-3 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-slate-700 dark:border-brand-900 dark:bg-slate-950 dark:text-slate-200">
          {documentHelpText(type)}
        </div>
        {message ? <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p> : null}
      </div>

      {summary ? (
        <div className="grid gap-3 md:grid-cols-5">
          <Metric label="Commandes en cours" value={summary.ordersInProgress} />
          <Metric label="Acomptes recus" value={money(summary.depositsReceived)} />
          <Metric label="Soldes a recevoir" value={money(summary.balancesToCollect)} />
          <Metric label="Pretes non soldees" value={summary.readyUnpaidOrders} />
          <Metric label="Terminees" value={summary.completedOrders} />
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">{createLabel}</h2>
          <p className="mt-1 text-sm text-slate-500">Ajoutez un client si besoin, puis choisissez un produit existant ou saisissez une ligne de service personnalisee.</p>
          <div className="mt-4 space-y-3">
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="">Client facultatif</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName ?? customer.name}</option>)}
            </select>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} placeholder="Remise globale" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <div className="mt-4 space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Rechercher un produit ou service" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                <select value={line.productId} onChange={(event) => selectProduct(index, event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                  <option value="">Service / ligne personnalisée</option>
                  {compactProducts.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}
                </select>
                {!line.productId ? <input required value={line.customName} onChange={(event) => updateLine(index, { customName: event.target.value })} placeholder="Nom du service ou de la commande speciale" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /> : null}
                {!line.productId && showFabricationFields ? (
                  <div className="grid gap-2 rounded-md bg-slate-50 p-3 dark:bg-slate-950 md:grid-cols-2">
                    <select value={line.customType} onChange={(event) => updateLine(index, { customType: event.target.value })} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <option value="SERVICE">Service personnalise</option>
                      {fabricationTypes.map((item) => <option key={item} value={item.toUpperCase().replaceAll(" ", "_")}>{item}</option>)}
                    </select>
                    <select value={line.material} onChange={(event) => updateLine(index, { material: event.target.value })} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <option value="">Materiau</option>
                      {fabricationMaterials.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <input value={line.width} onChange={(event) => updateLine(index, { width: event.target.value })} placeholder="Largeur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                    <input value={line.height} onChange={(event) => updateLine(index, { height: event.target.value })} placeholder="Hauteur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                    <input value={line.length} onChange={(event) => updateLine(index, { length: event.target.value })} placeholder="Longueur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                    <input value={line.thickness} onChange={(event) => updateLine(index, { thickness: event.target.value })} placeholder="Epaisseur / verre" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                    <input value={line.color} onChange={(event) => updateLine(index, { color: event.target.value })} placeholder="Couleur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                    <input type="date" value={line.installationDate} onChange={(event) => updateLine(index, { installationDate: event.target.value })} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                    <textarea value={line.measurementNotes} onChange={(event) => updateLine(index, { measurementNotes: event.target.value })} placeholder="Notes de mesure" className="min-h-20 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2" />
                    <textarea value={line.installationNotes} onChange={(event) => updateLine(index, { installationNotes: event.target.value })} placeholder="Adresse ou notes livraison / installation" className="min-h-20 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2" />
                  </div>
                ) : null}
                <div className="grid grid-cols-4 gap-2">
                  <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="rounded-md border px-2 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} className="rounded-md border px-2 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <input type="number" min="0" step="0.01" value={line.discount} onChange={(event) => updateLine(index, { discount: Number(event.target.value) })} className="rounded-md border px-2 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <input type="number" min="0" step="0.01" value={line.tax} onChange={(event) => updateLine(index, { tax: Number(event.target.value) })} className="rounded-md border px-2 py-2 dark:border-slate-700 dark:bg-slate-950" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={() => setLines([...lines, newLine()])} className="rounded-md border px-3 py-2 text-sm">Ajouter ligne</button>
            <p className="text-sm font-semibold">Total: {money(totalPreview)}</p>
          </div>
          <button className="mt-4 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button>
        </form>

        <section className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Recherche" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="">Tous les statuts</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
                <tr><th className="p-3">Numero</th><th className="p-3">Client</th><th className="p-3">Total</th><th className="p-3">Paye</th><th className="p-3">Solde</th><th className="p-3">Statut</th><th className="p-3">Action</th></tr>
              </thead>
              <tbody>
                {items.map((doc) => (
                  <tr key={doc.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-mono text-xs">{doc.number}</td>
                    <td className="p-3">{doc.customer?.displayName ?? doc.customer?.name ?? "--"}</td>
                    <td className="p-3">{money(doc.total)}</td>
                    <td className="p-3">{money(doc.paidAmount)}</td>
                    <td className="p-3">{money(doc.balance)}</td>
                    <td className="p-3">{statusLabels[doc.status] ?? doc.status}</td>
                    <td className="p-3"><button onClick={() => setSelected(doc)} className="text-brand-600">Detail</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <DocumentDetail
              selected={selected}
              type={type}
              transformAction={transformAction}
              transformLabel={transformLabel}
              paymentAmount={paymentAmount}
              paymentReference={paymentReference}
              canTakePayment={Boolean(canTakePayment)}
              onPaymentAmount={setPaymentAmount}
              onPaymentReference={setPaymentReference}
              onRegisterPayment={() => registerPayment(selected)}
              onAction={(action) => runAction(selected, action)}
              onStatus={(nextStatus) => updateStatus(selected, nextStatus)}
              onPrint={printSelected}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function DocumentDetail(props: {
  selected: SalesDocument;
  type: DocType;
  transformLabel?: string;
  transformAction?: string;
  paymentAmount: string;
  paymentReference: string;
  canTakePayment: boolean;
  onPaymentAmount: (value: string) => void;
  onPaymentReference: (value: string) => void;
  onRegisterPayment: () => void;
  onAction: (action: string) => void;
  onStatus: (status: string) => void;
  onPrint: () => void;
}) {
  const { selected, type } = props;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="printable-document">
        <p className="font-mono text-xs text-slate-500">{selected.number}</p>
        <h2 className="text-lg font-semibold">{documentKind(type)}</h2>
        <p className="text-sm text-slate-500">Client: {selected.customer?.displayName ?? selected.customer?.name ?? "--"}</p>
        <p className="text-sm text-slate-500">Statut: {statusLabels[selected.status] ?? selected.status}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr className="text-slate-500"><th className="p-2">Produit / service</th><th className="p-2">Qte</th><th className="p-2">Prix</th><th className="p-2">Remise</th><th className="p-2">Taxe</th><th className="p-2">Total</th></tr></thead>
            <tbody>
              {selected.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2">
                    <span className="font-medium">{item.product?.name ?? item.customName ?? "Service"}</span>
                    {item.customType && !item.product ? <span className="mt-1 block text-xs text-slate-500">Type: {item.customType.replaceAll("_", " ")}</span> : null}
                    {item.customNote ? <span className="mt-1 block whitespace-pre-wrap text-xs leading-5 text-slate-500">{item.customNote}</span> : null}
                  </td>
                  <td className="p-2">{item.quantity}</td>
                  <td className="p-2">{money(item.unitPrice)}</td>
                  <td className="p-2">{money(item.discount)}</td>
                  <td className="p-2">{money(item.tax)}</td>
                  <td className="p-2">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
          <Info label="Total" value={money(selected.total)} />
          <Info label="Acomptes / paye" value={money(selected.paidAmount)} />
          <Info label="Solde" value={money(selected.balance)} />
          <Info label="Paiements" value={selected.payments?.length ?? 0} />
        </div>
        {selected.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{selected.notes}</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={props.onPrint} className="rounded-md border px-3 py-2 text-sm">Imprimer</button>
        {type === "invoices" ? <button onClick={() => void openPrintPreview(`/invoices/${selected.id}/print`)} className="rounded-md border px-3 py-2 text-sm">Apercu facture</button> : null}
        {type === "invoices" ? <button onClick={() => void downloadPdf(`/invoices/${selected.id}/pdf`, `facture-${selected.number}.pdf`)} className="rounded-md border px-3 py-2 text-sm">PDF</button> : null}
        {type === "quotes" ? <button onClick={() => props.onAction("send")} className="rounded-md border px-3 py-2 text-sm">Envoyer</button> : null}
        {type === "quotes" ? <button onClick={() => props.onAction("accept")} className="rounded-md border px-3 py-2 text-sm">Accepter</button> : null}
        {props.transformAction ? <button onClick={() => props.onAction(props.transformAction!)} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white">{props.transformLabel}</button> : null}
        {type === "proformas" ? orderStatuses.map((status) => <button key={status} onClick={() => props.onStatus(status)} className="rounded-md border px-3 py-2 text-sm">{statusLabels[status]}</button>) : null}
      </div>

      {props.canTakePayment ? (
        <div className="mt-4 rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Ajouter un acompte / paiement partiel</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input type="number" min="0.01" step="0.01" value={props.paymentAmount} onChange={(event) => props.onPaymentAmount(event.target.value)} placeholder="Montant" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <input value={props.paymentReference} onChange={(event) => props.onPaymentReference(event.target.value)} placeholder="Reference facultative" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <button onClick={props.onRegisterPayment} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="font-semibold">{value}</p></div>;
}

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
  PARTIALLY_PAID: "Avance recue",
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
type LineMode = "catalog" | "custom";

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
  if (type === "quotes") return "Devis = proposition de prix. Il ne modifie pas le stock.";
  if (type === "proformas") return "Commande = vente confirmee qui peut recevoir une avance, puis la balance.";
  return "Facture = document de vente finalise ou a encaisser selon le statut.";
}

function documentCreateHelp(type: DocType) {
  if (type === "quotes") return "Saisissez seulement le client, les produits ou services, la quantite, le prix, la remise et les notes.";
  if (type === "proformas") return "Creez une commande directe, puis enregistrez une avance ou encaissez la balance quand le client paie.";
  return "Creez une facture seulement pour un document finalise.";
}

function documentListTitle(type: DocType) {
  if (type === "quotes") return "Devis recents";
  if (type === "proformas") return "Commandes recentes";
  return "Factures recentes";
}

function paymentActionLabel(document: SalesDocument) {
  return Number(document.paidAmount ?? 0) > 0 ? "Encaisser balance" : "Ajouter avance";
}

const fabricationTypes = ["Fenetre", "Porte", "Cadre", "Vitrine", "Moustiquaire", "Structure simple", "Autre"];
const fabricationMaterials = ["Aluminium", "Bois", "PVC", "Metal", "Verre", "Autre"];

function newLine(): Line {
  return { productId: "", customName: "", customType: "SERVICE", material: "", width: "", height: "", color: "", thickness: "", length: "", measurementNotes: "", installationDate: "", installationNotes: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 };
}

function lineDefaults(mode: LineMode): Line {
  const line = newLine();
  return mode === "catalog" ? { ...line, customName: "" } : line;
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
  const [lines, setLines] = useState<Line[]>([]);
  const [catalogDraft, setCatalogDraft] = useState<Line>(() => lineDefaults("catalog"));
  const [customDraft, setCustomDraft] = useState<Line>(() => lineDefaults("custom"));
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

  useEffect(() => {
    const initialStatus = new URLSearchParams(window.location.search).get("status");
    if (initialStatus) setStatus(initialStatus);
    void loadReferences();
  }, []);
  useEffect(() => { const timer = setTimeout(() => void loadDocuments(), 250); return () => clearTimeout(timer); }, [loadDocuments]);

  async function loadReferences() {
    const headers = { Authorization: `Bearer ${getAccessToken()}` };
    const [customersResponse, productsResponse, tenantConfiguration] = await Promise.all([
      fetch(`${apiUrl}/customers?limit=100`, { headers }),
      fetch(`${apiUrl}/products?limit=50`, { headers }),
      getTenantBusinessConfiguration().catch(() => null)
    ]);
    if (customersResponse.ok) setCustomers((await customersResponse.json()).items ?? []);
    if (productsResponse.ok) setProducts((await productsResponse.json()).items ?? []);
    setShowFabricationFields(isFabricationProfile(tenantConfiguration?.businessProfileType, tenantConfiguration?.primaryActivity));
  }

  const searchProducts = useCallback(async (term: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (term.trim()) params.set("search", term.trim());
    const response = await fetch(`${apiUrl}/products?${params}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!response.ok) return;
    const data = await response.json();
    const incoming: Product[] = data.items ?? [];
    setProducts((current) => {
      const merged = new Map<string, Product>();
      for (const product of current) merged.set(product.id, product);
      for (const product of incoming) merged.set(product.id, product);
      return Array.from(merged.values());
    });
  }, []);

  useEffect(() => {
    const term = productSearch.trim();
    if (!term) return;
    const timer = window.setTimeout(() => void searchProducts(term), 250);
    return () => window.clearTimeout(timer);
  }, [productSearch, searchProducts]);

  async function refreshSelected(id: string) {
    const response = await apiFetch(`/${type}/${id}`);
    if (response.ok) setSelected(await response.json());
  }

  function updateCatalogDraft(values: Partial<Line>) {
    setCatalogDraft((current) => ({ ...current, ...values }));
  }

  function updateCustomDraft(values: Partial<Line>) {
    setCustomDraft((current) => ({ ...current, ...values }));
  }

  function selectProduct(productId: string) {
    const product = products.find((item) => item.id === productId);
    updateCatalogDraft({ productId, customName: "", customType: "SERVICE", material: "", width: "", height: "", color: "", thickness: "", length: "", measurementNotes: "", installationDate: "", installationNotes: "", unitPrice: Number(product?.salePrice ?? 0) });
  }

  function addCatalogLine() {
    if (!catalogDraft.productId) {
      setMessage("Choisissez un produit du catalogue avant de l'ajouter.");
      return;
    }
    setLines((current) => [...current, catalogDraft]);
    setCatalogDraft(lineDefaults("catalog"));
    setProductSearch("");
    setMessage("");
  }

  function addCustomLine() {
    if (!customDraft.customName.trim()) {
      setMessage("Indiquez le nom ou la description de la ligne personnalisee.");
      return;
    }
    setLines((current) => [...current, { ...customDraft, productId: "" }]);
    setCustomDraft(lineDefaults("custom"));
    setMessage("");
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (lines.length === 0) {
      setMessage(type === "quotes" ? "Ajoutez au moins un produit ou service au devis." : "Ajoutez au moins un produit ou service a la commande.");
      return;
    }
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
      setLines([]);
      setCatalogDraft(lineDefaults("catalog"));
      setCustomDraft(lineDefaults("custom"));
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
      setMessage("Montant d'avance invalide.");
      return;
    }
    const response = await apiFetch(`/${type}/${document.id}/payments`, {
      method: "POST",
      body: JSON.stringify({ method: "CASH", amount, reference: paymentReference || undefined, notes: "Avance / paiement partiel" })
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

  function selectForPayment(document: SalesDocument) {
    setSelected(document);
    setMessage("Commande selectionnee: ajoutez l'avance ou la balance dans le detail.");
  }

  const totalPreview = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount + line.tax, 0) - discount, [lines, discount]);
  const canTakePayment = selected && (type === "proformas" || type === "invoices") && Number(selected.balance) > 0 && selected.status !== "CANCELLED";
  function compactProducts() {
    const term = productSearch.trim().toLowerCase();
    const filtered = term ? products.filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(term)) : products;
    return filtered.slice(0, 20);
  }

  const addToDocumentLabel = type === "quotes" ? "Ajouter au devis" : type === "proformas" ? "Ajouter a la commande" : "Ajouter au document";
  const addCustomToDocumentLabel = type === "quotes" ? "Ajouter la ligne au devis" : type === "proformas" ? "Ajouter la ligne a la commande" : "Ajouter la ligne";
  const selectedCatalogProduct = products.find((product) => product.id === catalogDraft.productId);
  const currentBalancePreview = type === "proformas" ? Math.max(totalPreview, 0) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Flux V1: produit existant ou service personnalise, devis, commande, avance, balance, impression, puis termine.</p>
        <div className="mt-3 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-slate-700 dark:border-brand-900 dark:bg-slate-950 dark:text-slate-200">
          {documentHelpText(type)}
        </div>
        {message ? <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p> : null}
      </div>

      {summary ? (
        <div className="grid gap-3 md:grid-cols-5">
          <Metric label="Commandes en cours" value={summary.ordersInProgress} />
          <Metric label="Avances recues" value={money(summary.depositsReceived)} />
          <Metric label="Balances a recevoir" value={money(summary.balancesToCollect)} />
          <Metric label="Pretes avec balance" value={summary.readyUnpaidOrders} />
          <Metric label="Terminees" value={summary.completedOrders} />
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">{type === "quotes" ? "Creer un devis" : type === "proformas" ? "Nouvelle commande" : createLabel}</h2>
          <p className="mt-1 text-sm text-slate-500">{documentCreateHelp(type)}</p>
          <div className="mt-4 space-y-3">
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="">Client facultatif</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName ?? customer.name}</option>)}
            </select>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} placeholder="Remise globale" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-brand-100 bg-brand-50 p-4 dark:border-brand-900 dark:bg-slate-950">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-950 dark:text-white">A) Produit du catalogue</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">La liste charge les produits disponibles. La recherche trouve aussi un produit hors des premiers resultats.</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-slate-900 dark:text-brand-200">{compactProducts().length} produits visibles</span>
              </div>
              <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Rechercher un produit" className="mt-3 w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
                {compactProducts().map((product) => (
                  <ProductResultCard
                    key={product.id}
                    product={product}
                    selected={catalogDraft.productId === product.id}
                    onSelect={() => selectProduct(product.id)}
                  />
                ))}
                {compactProducts().length === 0 ? <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">Aucun produit trouve. Utilisez la ligne personnalisee si besoin.</p> : null}
              </div>
              {selectedCatalogProduct ? <SelectedProduct product={selectedCatalogProduct} /> : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <NumberField label="Quantite" min="1" value={catalogDraft.quantity} onChange={(value) => updateCatalogDraft({ quantity: value })} />
                <NumberField label="Prix modifiable" min="0" step="0.01" value={catalogDraft.unitPrice} onChange={(value) => updateCatalogDraft({ unitPrice: value })} />
                <NumberField label="Remise" min="0" step="0.01" value={catalogDraft.discount} onChange={(value) => updateCatalogDraft({ discount: value })} />
              </div>
              <button type="button" onClick={addCatalogLine} className="mt-3 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{addToDocumentLabel}</button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-bold text-slate-950 dark:text-white">B) Ajouter un service ou travail personnalise</p>
              <p className="mt-1 text-xs text-slate-500">Pour un service, une reparation, une fabrication ou un travail special absent du catalogue.</p>
              <input value={customDraft.customName} onChange={(event) => updateCustomDraft({ customName: event.target.value })} placeholder="Nom ou description" className="mt-3 w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
              {showFabricationFields ? (
                <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 dark:bg-slate-950 md:grid-cols-2">
                  <select value={customDraft.customType} onChange={(event) => updateCustomDraft({ customType: event.target.value })} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                    <option value="SERVICE">Service personnalise</option>
                    {fabricationTypes.map((item) => <option key={item} value={item.toUpperCase().replaceAll(" ", "_")}>{item}</option>)}
                  </select>
                  <select value={customDraft.material} onChange={(event) => updateCustomDraft({ material: event.target.value })} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                    <option value="">Materiau</option>
                    {fabricationMaterials.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <input value={customDraft.width} onChange={(event) => updateCustomDraft({ width: event.target.value })} placeholder="Largeur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <input value={customDraft.height} onChange={(event) => updateCustomDraft({ height: event.target.value })} placeholder="Hauteur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <input value={customDraft.length} onChange={(event) => updateCustomDraft({ length: event.target.value })} placeholder="Longueur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <input value={customDraft.thickness} onChange={(event) => updateCustomDraft({ thickness: event.target.value })} placeholder="Epaisseur / verre" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <input value={customDraft.color} onChange={(event) => updateCustomDraft({ color: event.target.value })} placeholder="Couleur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <input type="date" value={customDraft.installationDate} onChange={(event) => updateCustomDraft({ installationDate: event.target.value })} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <textarea value={customDraft.measurementNotes} onChange={(event) => updateCustomDraft({ measurementNotes: event.target.value })} placeholder="Notes de mesure" className="min-h-20 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2" />
                  <textarea value={customDraft.installationNotes} onChange={(event) => updateCustomDraft({ installationNotes: event.target.value })} placeholder="Adresse ou notes livraison / installation" className="min-h-20 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2" />
                </div>
              ) : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <NumberField label="Quantite" min="1" value={customDraft.quantity} onChange={(value) => updateCustomDraft({ quantity: value })} />
                <NumberField label="Prix" min="0" step="0.01" value={customDraft.unitPrice} onChange={(value) => updateCustomDraft({ unitPrice: value })} />
                <NumberField label="Remise" min="0" step="0.01" value={customDraft.discount} onChange={(value) => updateCustomDraft({ discount: value })} />
              </div>
              <button type="button" onClick={addCustomLine} className="mt-3 w-full rounded-md border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 dark:border-brand-700 dark:text-brand-200">{addCustomToDocumentLabel}</button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Lignes ajoutees</h3>
              <span className="text-xs text-slate-500">{lines.length} ligne{lines.length > 1 ? "s" : ""}</span>
            </div>
            {lines.length === 0 ? <p className="mt-2 text-sm text-slate-500">Aucune ligne ajoutee pour l&apos;instant. Choisissez un produit du catalogue ou ajoutez une ligne personnalisee.</p> : null}
            <div className="mt-3 space-y-2">
              {lines.map((line, index) => <LinePreview key={`${line.productId}-${line.customName}-${index}`} line={line} index={index} product={products.find((product) => product.id === line.productId)} onRemove={() => removeLine(index)} />)}
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
            <div className="grid gap-2 sm:grid-cols-3">
              <Info label={type === "quotes" ? "Total devis" : "Total commande"} value={money(totalPreview)} />
              <Info label="Avance recue" value={money(0)} />
              <Info label="Balance restante" value={money(currentBalancePreview ?? totalPreview)} />
            </div>
            <p className="mt-3 text-xs text-slate-300">{type === "quotes" ? "Le devis ne modifie pas le stock et ne cree pas de vente POS." : "La commande V1 ne modifie pas le stock et ne cree pas de vente POS automatiquement."}</p>
          </div>

          <button className="mt-4 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{type === "quotes" ? "Enregistrer devis" : type === "proformas" ? "Enregistrer commande" : "Enregistrer"}</button>
        </form>

        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">{documentListTitle(type)}</h2>
            <p className="mt-1 text-sm text-slate-500">Actions visibles: voir, imprimer, convertir, recevoir une avance, encaisser la balance et changer le statut.</p>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Recherche" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="">Tous les statuts</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="grid gap-3 md:hidden">
            {items.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                type={type}
                transformAction={transformAction}
                transformLabel={transformLabel}
                onSelect={() => setSelected(doc)}
                onPrint={() => { setSelected(doc); setTimeout(() => window.print(), 0); }}
                onAction={(action) => runAction(doc, action)}
                onPayment={() => selectForPayment(doc)}
                onStatus={(nextStatus) => updateStatus(doc, nextStatus)}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
                <tr><th className="p-3">Numero</th><th className="p-3">Client</th><th className="p-3">Total</th><th className="p-3">Avance</th><th className="p-3">Balance</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr>
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
                    <td className="p-3">
                      <DocumentActions
                        doc={doc}
                        type={type}
                        transformAction={transformAction}
                        transformLabel={transformLabel}
                        onSelect={() => setSelected(doc)}
                        onPrint={() => { setSelected(doc); setTimeout(() => window.print(), 0); }}
                        onAction={(action) => runAction(doc, action)}
                        onPayment={() => selectForPayment(doc)}
                        onStatus={(nextStatus) => updateStatus(doc, nextStatus)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <h3 className="font-semibold text-slate-950 dark:text-white">{type === "quotes" ? "Aucun devis pour l'instant" : type === "proformas" ? "Aucune commande pour l'instant" : "Aucune facture pour l'instant"}</h3>
              <p className="mt-1">{type === "quotes" ? "Créez un devis avec un produit existant ou une ligne personnalisee, sans toucher au stock." : type === "proformas" ? "Créez une commande pour suivre Total, Avance, Balance et statuts." : "Les documents finalisés apparaîtront ici."}</p>
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{type === "quotes" ? "Créer un devis" : type === "proformas" ? "Créer une commande" : createLabel}</button>
            </div>
          ) : null}
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

function ProductResultCard({ product, selected, onSelect }: { product: Product; selected: boolean; onSelect: () => void }) {
  return <button
    type="button"
    onClick={onSelect}
    className={`rounded-md border p-3 text-left transition ${selected ? "border-brand-500 bg-white ring-2 ring-brand-100 dark:bg-slate-900 dark:ring-brand-950" : "border-slate-200 bg-white hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-semibold text-slate-950 dark:text-white">{product.name}</p>
        <p className="mt-1 text-xs text-slate-500">{product.unit ? `Unite: ${product.unit}` : "Produit catalogue"}</p>
      </div>
      <span className="shrink-0 text-sm font-bold text-brand-700 dark:text-brand-200">{money(product.salePrice)}</span>
    </div>
    <span className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{selected ? "Selectionne" : "Choisir"}</span>
  </button>;
}

function SelectedProduct({ product }: { product?: Product }) {
  if (!product) return null;
  return <div className="mt-3 rounded-md border border-brand-100 bg-white p-3 text-xs text-slate-600 dark:border-brand-900 dark:bg-slate-900 dark:text-slate-300">
    <p className="font-semibold text-slate-900 dark:text-white">Produit selectionne: {product.name}</p>
    <p className="mt-1">Prix: {money(product.salePrice)}{product.unit ? ` · Unite: ${product.unit}` : ""}</p>
    <p className="mt-1 text-slate-500">SKU: {product.sku}</p>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function NumberField({ label, value, min, step, onChange }: { label: string; value: number; min: string; step?: string; onChange: (value: number) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-500">
    {label}
    <input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="rounded-md border px-2 py-2 text-sm font-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
  </label>;
}

function LinePreview({ line, index, product, onRemove }: { line: Line; index: number; product?: Product; onRemove: () => void }) {
  const lineName = product?.name ?? line.customName;
  const lineSku = product?.sku;
  const lineUnit = product?.unit;
  const lineTotal = line.quantity * line.unitPrice - line.discount + line.tax;
  return <div className="rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-semibold text-slate-950 dark:text-white">{index + 1}. {lineName || "Ligne sans nom"}</p>
        <p className="mt-1 text-xs text-slate-500">
          {line.productId ? "Produit catalogue" : "Ligne personnalisee"}
          {lineSku ? ` · ${lineSku}` : ""}
          {lineUnit ? ` · ${lineUnit}` : ""}
        </p>
      </div>
      <button type="button" onClick={onRemove} className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:text-red-300">Retirer</button>
    </div>
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
      <Info label="Quantite" value={line.quantity} />
      <Info label="Prix" value={money(line.unitPrice)} />
      <Info label="Remise" value={money(line.discount)} />
      <Info label="Total ligne" value={money(lineTotal)} />
    </div>
  </div>;
}

function DocumentActions(props: {
  doc: SalesDocument;
  type: DocType;
  transformLabel?: string;
  transformAction?: string;
  onSelect: () => void;
  onPrint: () => void;
  onAction: (action: string) => void;
  onPayment: () => void;
  onStatus: (status: string) => void;
}) {
  const { doc, type } = props;
  return <div className="flex flex-wrap gap-2">
    <button onClick={props.onSelect} className="rounded-md border px-2 py-1 text-xs">Voir</button>
    <button onClick={props.onPrint} className="rounded-md border px-2 py-1 text-xs">Imprimer</button>
    {type === "quotes" && props.transformAction ? <button onClick={() => props.onAction(props.transformAction!)} className="rounded-md bg-brand-600 px-2 py-1 text-xs font-semibold text-white">{props.transformLabel ?? "Convertir"}</button> : null}
    {type === "quotes" ? <button onClick={() => props.onAction("reject")} className="rounded-md border px-2 py-1 text-xs">Annuler</button> : null}
    {type === "proformas" && Number(doc.balance) > 0 ? <button onClick={props.onPayment} className="rounded-md border px-2 py-1 text-xs">{paymentActionLabel(doc)}</button> : null}
    {type === "proformas" && doc.status !== "READY" ? <button onClick={() => props.onStatus("READY")} className="rounded-md border px-2 py-1 text-xs">Marquer prete</button> : null}
    {type === "proformas" && doc.status !== "DELIVERED" ? <button onClick={() => props.onStatus("DELIVERED")} className="rounded-md border px-2 py-1 text-xs">Marquer livree</button> : null}
    {type === "proformas" && doc.status !== "COMPLETED" ? <button onClick={() => props.onStatus("COMPLETED")} className="rounded-md border px-2 py-1 text-xs">Terminer</button> : null}
    {type === "proformas" && doc.status !== "CANCELLED" ? <button onClick={() => props.onStatus("CANCELLED")} className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700">Annuler</button> : null}
  </div>;
}

function DocumentCard(props: {
  doc: SalesDocument;
  type: DocType;
  transformLabel?: string;
  transformAction?: string;
  onSelect: () => void;
  onPrint: () => void;
  onAction: (action: string) => void;
  onPayment: () => void;
  onStatus: (status: string) => void;
}) {
  const { doc } = props;
  return <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-mono text-xs text-slate-500">{doc.number}</p>
        <h3 className="font-semibold">{doc.customer?.displayName ?? doc.customer?.name ?? "Client non defini"}</h3>
      </div>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{statusLabels[doc.status] ?? doc.status}</span>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
      <Info label="Total" value={money(doc.total)} />
      <Info label="Avance" value={money(doc.paidAmount)} />
      <Info label="Balance" value={money(doc.balance)} />
    </div>
    <div className="mt-3">
      <DocumentActions {...props} />
    </div>
  </article>;
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
          <Info label="Avance" value={money(selected.paidAmount)} />
          <Info label="Balance" value={money(selected.balance)} />
          <Info label="Paiements" value={selected.payments?.length ?? 0} />
        </div>
        {selected.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{selected.notes}</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={props.onPrint} className="rounded-md border px-3 py-2 text-sm">Imprimer</button>
        {type === "invoices" ? <button onClick={() => void openPrintPreview(`/invoices/${selected.id}/print`)} className="rounded-md border px-3 py-2 text-sm">Apercu facture</button> : null}
        {type === "invoices" ? <button onClick={() => void downloadPdf(`/invoices/${selected.id}/pdf`, `facture-${selected.number}.pdf`)} className="rounded-md border px-3 py-2 text-sm">PDF</button> : null}
        {props.transformAction ? <button onClick={() => props.onAction(props.transformAction!)} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white">{props.transformLabel}</button> : null}
        {type === "proformas" ? orderStatuses.map((status) => <button key={status} onClick={() => props.onStatus(status)} className="rounded-md border px-3 py-2 text-sm">{statusLabels[status]}</button>) : null}
      </div>

      {props.canTakePayment ? (
        <div className="mt-4 rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Ajouter une avance ou encaisser la balance</h3>
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

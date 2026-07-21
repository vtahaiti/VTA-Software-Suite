"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001");

type DocType = "quotes" | "proformas" | "invoices";
type Customer = { id: string; name?: string; displayName?: string };
type Product = { id: string; sku?: string | null; name: string; salePrice?: string | number | null; stockCurrent?: number | null; unit?: string | { name?: string | null; symbol?: string | null } | null };
type Payment = { id: string; amount: string | number; method: string; createdAt: string };
type DocumentItem = { id: string; quantity: number; unitPrice: string | number; discount: string | number; tax: string | number; total: string | number; customName?: string | null; product?: Product | null };
type SalesDocument = {
  id: string;
  number?: string;
  documentNumber?: string;
  status: string;
  paymentStatus?: string | null;
  total: string | number;
  paidAmount: string | number;
  balance: string | number;
  createdAt: string;
  customer?: Customer | null;
  items?: DocumentItem[];
  payments?: Payment[];
};

type Line = {
  productId?: string;
  customName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
};

type Props = {
  type: DocType;
  title: string;
  eyebrow: string;
  createLabel: string;
  transformLabel?: string;
  transformAction?: string;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
  CONVERTED: "Converti",
  CONFIRMED: "Confirmée",
  IN_PROGRESS: "En préparation",
  READY: "Prête",
  DELIVERED: "Livrée",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  UNPAID: "Non payée",
  PARTIALLY_PAID: "Avance reçue",
  PAID: "Payée"
};

const orderStatuses = [
  { value: "CONFIRMED", label: "Confirmer" },
  { value: "IN_PROGRESS", label: "En préparation" },
  { value: "READY", label: "Marquer prête" },
  { value: "DELIVERED", label: "Marquer livrée" },
  { value: "COMPLETED", label: "Terminer" },
  { value: "CANCELLED", label: "Annuler" }
];

function money(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function unitLabel(product?: Product | null) {
  if (!product?.unit) return "";
  if (typeof product.unit === "string") return product.unit;
  return product.unit.symbol ?? product.unit.name ?? "";
}

function documentName(type: DocType) {
  if (type === "quotes") return "devis";
  if (type === "proformas") return "commande";
  return "facture";
}

function createTitle(type: DocType) {
  if (type === "quotes") return "Créer un devis";
  if (type === "proformas") return "Créer une commande";
  return "Créer une facture";
}

function emptyLine(): Line {
  return { quantity: 1, unitPrice: 0, discount: 0, tax: 0 };
}

export function SalesDocumentPage({ type, title, eyebrow, createLabel, transformAction, transformLabel }: Props) {
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [catalogLine, setCatalogLine] = useState<Line>(emptyLine);
  const [customLine, setCustomLine] = useState<Line>(emptyLine);
  const [lines, setLines] = useState<Line[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const apiFetch = useCallback((path: string, init?: RequestInit) => {
    return fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
        ...(init?.headers ?? {})
      }
    });
  }, []);

  const loadDocuments = useCallback(async () => {
    const query = new URLSearchParams({ limit: "30" });
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const paymentStatus = urlParams.get("paymentStatus");
    if (status) query.set("status", status);
    if (paymentStatus) query.set("paymentStatus", paymentStatus);
    const response = await apiFetch(`/${type}?${query.toString()}`);
    if (response.ok) setDocuments((await response.json()).items ?? []);
  }, [apiFetch, type]);

  const loadReferences = useCallback(async () => {
    const [customersResponse, productsResponse] = await Promise.all([
      apiFetch("/customers?limit=100"),
      apiFetch("/products?limit=30")
    ]);
    if (customersResponse.ok) setCustomers((await customersResponse.json()).items ?? []);
    if (productsResponse.ok) setProducts((await productsResponse.json()).items ?? []);
  }, [apiFetch]);

  useEffect(() => {
    void loadReferences();
    void loadDocuments();
  }, [loadDocuments, loadReferences]);

  const searchProducts = useCallback(async (term: string) => {
    const query = new URLSearchParams({ limit: "30" });
    if (term.trim()) query.set("search", term.trim());
    const response = await apiFetch(`/products?${query.toString()}`);
    if (!response.ok) return;
    const incoming: Product[] = (await response.json()).items ?? [];
    setProducts((current) => {
      const merged = new Map<string, Product>();
      for (const product of current) merged.set(product.id, product);
      for (const product of incoming) merged.set(product.id, product);
      return Array.from(merged.values());
    });
  }, [apiFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => void searchProducts(productSearch), 250);
    return () => window.clearTimeout(timer);
  }, [productSearch, searchProducts]);

  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const filtered = term ? products.filter((product) => `${product.name} ${product.sku ?? ""}`.toLowerCase().includes(term)) : products;
    return filtered.slice(0, 12);
  }, [productSearch, products]);

  const totalPreview = useMemo(() => {
    return Math.max(0, lines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount + line.tax, 0) - globalDiscount);
  }, [globalDiscount, lines]);

  function chooseProduct(product: Product) {
    setSelectedProduct(product);
    setCatalogLine({ productId: product.id, quantity: 1, unitPrice: numberValue(product.salePrice), discount: 0, tax: 0 });
  }

  function addCatalogLine() {
    if (!selectedProduct) {
      setMessage("Choisissez un produit du catalogue.");
      return;
    }
    setLines((current) => [...current, { ...catalogLine, productId: selectedProduct.id }]);
    setSelectedProduct(null);
    setCatalogLine(emptyLine());
    setMessage("");
  }

  function addCustomLine() {
    if (!customLine.customName?.trim()) {
      setMessage("Indiquez le nom du service ou du travail personnalisé.");
      return;
    }
    setLines((current) => [...current, { ...customLine, productId: undefined }]);
    setCustomLine(emptyLine());
    setMessage("");
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (lines.length === 0) {
      setMessage(`Ajoutez au moins une ligne au ${documentName(type)}.`);
      return;
    }
    setLoading(true);
    const response = await apiFetch(`/${type}`, {
      method: "POST",
      body: JSON.stringify({
        customerId: customerId || undefined,
        notes,
        discount: globalDiscount,
        items: lines.map((line) => ({
          productId: line.productId,
          customName: line.productId ? undefined : line.customName,
          customType: line.productId ? undefined : "SERVICE",
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          tax: line.tax
        }))
      })
    });
    setLoading(false);
    if (response.ok) {
      setLines([]);
      setNotes("");
      setGlobalDiscount(0);
      setMessage(`${createLabel} enregistré.`);
      await loadDocuments();
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Enregistrement impossible.");
  }

  async function runTransform(document: SalesDocument) {
    if (!transformAction) return;
    const response = await apiFetch(`/${type}/${document.id}/${transformAction}`, { method: "POST" });
    if (response.ok) {
      setMessage("Devis converti en commande.");
      await loadDocuments();
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(body?.message ?? "Conversion impossible.");
  }

  async function updateOrderStatus(document: SalesDocument, status: string) {
    const response = await apiFetch(`/proformas/${document.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (response.ok) {
      setMessage("Statut mis à jour.");
      await loadDocuments();
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(body?.message ?? "Statut impossible.");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {type === "quotes"
            ? "Le devis prépare un prix. Il ne modifie pas le stock et ne crée pas de vente POS."
            : type === "proformas"
              ? "La commande suit Total, Avance, Balance, préparation et livraison."
              : "Document finalisé issu d'une vente ou d'une commande."}
        </p>
        {message ? <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p> : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{createTitle(type)}</h2>
            <p className="mt-1 text-sm text-slate-500">Choisissez un produit existant ou ajoutez un service personnalisé.</p>
          </div>

          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Client facultatif</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName ?? customer.name}</option>)}
          </select>

          <section className="rounded-lg border border-brand-100 bg-brand-50 p-4 dark:border-brand-900 dark:bg-slate-950">
            <h3 className="font-semibold text-slate-950 dark:text-white">A) Produit du catalogue</h3>
            <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Rechercher un produit" className="mt-3 w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <div className="mt-3 grid max-h-72 gap-2 overflow-auto">
              {visibleProducts.map((product) => (
                <button key={product.id} type="button" onClick={() => chooseProduct(product)} className={`rounded-md border p-3 text-left transition ${selectedProduct?.id === product.id ? "border-brand-500 bg-white ring-2 ring-brand-100 dark:bg-slate-900" : "border-slate-200 bg-white hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950 dark:text-white">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{unitLabel(product) || "Produit catalogue"}{Number.isFinite(Number(product.stockCurrent)) ? ` · Stock ${product.stockCurrent}` : ""}</p>
                    </div>
                    <span className="text-sm font-bold text-brand-700 dark:text-brand-200">{money(product.salePrice)}</span>
                  </div>
                </button>
              ))}
            </div>
            {selectedProduct ? (
              <div className="mt-3 rounded-md border border-brand-200 bg-white p-3 dark:border-brand-900 dark:bg-slate-900">
                <p className="font-semibold text-slate-950 dark:text-white">Produit sélectionné: {selectedProduct.name}</p>
                <p className="text-xs text-slate-500">SKU: {selectedProduct.sku ?? "--"}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <NumberInput label="Quantité" value={catalogLine.quantity} min="0.01" step="0.01" onChange={(quantity) => setCatalogLine((line) => ({ ...line, quantity }))} />
                  <NumberInput label="Prix" value={catalogLine.unitPrice} min="0" step="0.01" onChange={(unitPrice) => setCatalogLine((line) => ({ ...line, unitPrice }))} />
                  <NumberInput label="Remise" value={catalogLine.discount} min="0" step="0.01" onChange={(discount) => setCatalogLine((line) => ({ ...line, discount }))} />
                </div>
                <button type="button" onClick={addCatalogLine} className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{type === "quotes" ? "Ajouter au devis" : "Ajouter à la commande"}</button>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-semibold text-slate-950 dark:text-white">B) Ligne personnalisée ou service</h3>
            <input value={customLine.customName ?? ""} onChange={(event) => setCustomLine((line) => ({ ...line, customName: event.target.value }))} placeholder="Nom ou description" className="mt-3 w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <NumberInput label="Quantité" value={customLine.quantity} min="0.01" step="0.01" onChange={(quantity) => setCustomLine((line) => ({ ...line, quantity }))} />
              <NumberInput label="Prix" value={customLine.unitPrice} min="0" step="0.01" onChange={(unitPrice) => setCustomLine((line) => ({ ...line, unitPrice }))} />
              <NumberInput label="Remise" value={customLine.discount} min="0" step="0.01" onChange={(discount) => setCustomLine((line) => ({ ...line, discount }))} />
            </div>
            <button type="button" onClick={addCustomLine} className="mt-3 rounded-md border px-4 py-2 text-sm font-semibold">{type === "quotes" ? "Ajouter au devis" : "Ajouter à la commande"}</button>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-slate-950 dark:text-white">Lignes ajoutées</h3>
            {lines.length === 0 ? <p className="rounded-md border border-dashed p-3 text-sm text-slate-500 dark:border-slate-800">Aucune ligne ajoutée.</p> : null}
            {lines.map((line, index) => {
              const product = line.productId ? products.find((item) => item.id === line.productId) : null;
              return <LineCard key={`${line.productId ?? line.customName}-${index}`} line={line} product={product} index={index} onRemove={() => removeLine(index)} />;
            })}
          </section>

          <div className="grid gap-2 sm:grid-cols-3">
            <NumberInput label="Remise globale" value={globalDiscount} min="0" step="0.01" onChange={setGlobalDiscount} />
            <SummaryBox label="Total" value={money(totalPreview)} />
            {type === "proformas" ? <SummaryBox label="Balance" value={money(totalPreview)} /> : null}
          </div>

          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="min-h-24 w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <button disabled={loading} className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Enregistrement..." : createLabel}</button>
        </form>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{type === "quotes" ? "Devis" : type === "proformas" ? "Commandes" : "Factures"}</h2>
              <p className="text-sm text-slate-500">{documents.length} document(s) affiché(s)</p>
            </div>
            <Link href={`/dashboard/sales/${type}/create`} className="rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white">{createLabel}</Link>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <h3 className="font-semibold text-slate-950 dark:text-white">{type === "quotes" ? "Aucun devis pour l'instant" : type === "proformas" ? "Aucune commande pour l'instant" : "Aucune facture pour l'instant"}</h3>
              <p className="mt-1">{type === "quotes" ? "Créez un devis avec un produit existant ou un service personnalisé." : "Créez une commande pour suivre Total, Avance et Balance."}</p>
            </div>
          ) : null}

          <div className="grid gap-3 md:hidden">
            {documents.map((document) => (
              <DocumentCard key={document.id} document={document} type={type} transformLabel={transformLabel} onTransform={() => runTransform(document)} onStatus={(status) => updateOrderStatus(document, status)} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
                <tr><th className="p-3">Numéro</th><th className="p-3">Client</th><th className="p-3">Total</th><th className="p-3">Avance</th><th className="p-3">Balance</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-mono text-xs">{document.documentNumber ?? document.number}</td>
                    <td className="p-3">{document.customer?.displayName ?? document.customer?.name ?? "--"}</td>
                    <td className="p-3">{money(document.total)}</td>
                    <td className="p-3">{money(document.paidAmount)}</td>
                    <td className="p-3">{money(document.balance)}</td>
                    <td className="p-3"><StatusBadge status={document.status} paymentStatus={document.paymentStatus} /></td>
                    <td className="p-3"><DocumentActions document={document} type={type} transformLabel={transformLabel} onTransform={() => runTransform(document)} onStatus={(status) => updateOrderStatus(document, status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function NumberInput({ label, value, min, step, onChange }: { label: string; value: number; min: string; step: string; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-500">
      {label}
      <input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="rounded-md border px-3 py-2 text-sm font-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
    </label>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="font-bold">{value}</p></div>;
}

function LineCard({ line, product, index, onRemove }: { line: Line; product?: Product | null; index: number; onRemove: () => void }) {
  const total = line.quantity * line.unitPrice - line.discount + line.tax;
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950 dark:text-white">{index + 1}. {product?.name ?? line.customName}</p>
          <p className="text-xs text-slate-500">{product ? `Produit catalogue${product.sku ? ` · ${product.sku}` : ""}` : "Service personnalisé"}</p>
        </div>
        <button type="button" onClick={onRemove} className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:text-red-300">Retirer</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryBox label="Quantité" value={String(line.quantity)} />
        <SummaryBox label="Prix" value={money(line.unitPrice)} />
        <SummaryBox label="Remise" value={money(line.discount)} />
        <SummaryBox label="Total ligne" value={money(total)} />
      </div>
    </article>
  );
}

function DocumentCard(props: { document: SalesDocument; type: DocType; transformLabel?: string; onTransform: () => void; onStatus: (status: string) => void }) {
  const { document } = props;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-500">{document.documentNumber ?? document.number}</p>
          <h3 className="font-semibold text-slate-950 dark:text-white">{document.customer?.displayName ?? document.customer?.name ?? "Client non défini"}</h3>
        </div>
        <StatusBadge status={document.status} paymentStatus={document.paymentStatus} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <SummaryBox label="Total" value={money(document.total)} />
        <SummaryBox label="Avance" value={money(document.paidAmount)} />
        <SummaryBox label="Balance" value={money(document.balance)} />
      </div>
      <div className="mt-3"><DocumentActions {...props} /></div>
    </article>
  );
}

function DocumentActions({ document, type, transformLabel, onTransform, onStatus }: { document: SalesDocument; type: DocType; transformLabel?: string; onTransform: () => void; onStatus: (status: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/dashboard/sales/${type}/${document.id}`} className="rounded-md border px-3 py-2 text-xs font-semibold">Voir</Link>
      <Link href={`/dashboard/sales/${type}/${document.id}`} className="rounded-md border px-3 py-2 text-xs font-semibold">Imprimer</Link>
      {type === "quotes" ? <button type="button" onClick={onTransform} className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white">{transformLabel ?? "Convertir en commande"}</button> : null}
      {type === "proformas" ? orderStatuses.map((status) => (
        <button key={status.value} type="button" onClick={() => onStatus(status.value)} className="rounded-md border px-3 py-2 text-xs font-semibold">{status.label}</button>
      )) : null}
    </div>
  );
}

function StatusBadge({ status, paymentStatus }: { status: string; paymentStatus?: string | null }) {
  const label = paymentStatus && paymentStatus !== "UNPAID" ? `${statusLabels[status] ?? status} · ${statusLabels[paymentStatus] ?? paymentStatus}` : statusLabels[status] ?? status;
  return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{label}</span>;
}

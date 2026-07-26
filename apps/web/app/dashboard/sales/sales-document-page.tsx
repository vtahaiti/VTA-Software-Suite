"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import Link from "next/link";
import { Fragment, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { getCompanyBranding, type CompanyBranding } from "@/lib/company-branding";
import { getTenantBusinessConfiguration, type TenantBusinessConfiguration } from "@/lib/business-profiles";

const FABRICATION_WORK_TYPES = ["Fenêtre", "Porte", "Cadre", "Vitrine", "Moustiquaire", "Autre"];
const FABRICATION_MATERIALS = ["Aluminium", "Bois", "PVC", "Métal", "Verre", "Autre"];

function isFabricationProfile(business: TenantBusinessConfiguration | null) {
  return business?.businessProfileType === "windows-aluminium";
}

type DocType = "quotes" | "proformas" | "invoices";
type Customer = { id: string; name?: string; displayName?: string };
type Product = { id: string; sku?: string | null; name: string; salePrice?: string | number | null; stockCurrent?: number | null; unit?: string | { name?: string | null; symbol?: string | null } | null };
type Payment = { id: string; amount: string | number; method: string; createdAt: string };
type DocumentItem = { id: string; quantity: number; unitPrice: string | number; discount: string | number; tax: string | number; total: string | number; customName?: string | null; customNote?: string | null; product?: Product | null };
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
  customNote?: string;
  label: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  showFabDetails?: boolean;
  fabWorkType?: string;
  fabMaterial?: string;
  fabWidth?: string;
  fabHeight?: string;
  fabLength?: string;
  fabColor?: string;
  fabGlass?: string;
};

function composeFabricationNote(line: Line) {
  const parts = [
    line.fabWorkType,
    line.fabMaterial,
    [line.fabWidth, line.fabHeight, line.fabLength].filter(Boolean).length ? `${line.fabWidth || "?"}x${line.fabHeight || "?"}${line.fabLength ? `x${line.fabLength}` : ""}cm` : "",
    line.fabColor,
    line.fabGlass ? `Verre ${line.fabGlass}` : ""
  ].filter((part) => part && part.trim());
  return parts.length ? parts.join(" · ") : undefined;
}

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
  CONVERTED: "Converti en commande",
  CONFIRMED: "Commande en cours",
  IN_PROGRESS: "En préparation",
  READY: "Prête",
  DELIVERED: "Livrée",
  COMPLETED: "Vente terminée",
  CANCELLED: "Annulée",
  UNPAID: "Non payée",
  PARTIALLY_PAID: "Avance reçue",
  PAID: "Payée"
};

const fabricationStatusLabels: Record<string, string> = {
  IN_PROGRESS: "En cours / En fabrication",
  READY: "Prête pour livraison/installation",
  DELIVERED: "Livrée/installée"
};

function statusLabel(status: string, showFabricationFields?: boolean) {
  if (showFabricationFields && fabricationStatusLabels[status]) return fabricationStatusLabels[status];
  return statusLabels[status] ?? status;
}

function money(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function documentName(type: DocType) {
  if (type === "quotes") return "devis";
  if (type === "proformas") return "commande";
  return "facture";
}

function createTitle(type: DocType) {
  if (type === "quotes") return "Nouveau devis";
  if (type === "proformas") return "Nouvelle commande";
  return "Nouvelle facture";
}

function emptyLine(): Line {
  return { label: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 };
}

function lineTotal(line: Line) {
  return line.quantity * line.unitPrice - line.discount + line.tax;
}

function matchingProducts(products: Product[], query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return products.filter((product) => `${product.name} ${product.sku ?? ""}`.toLowerCase().includes(term)).slice(0, 8);
}

export function SalesDocumentPage({ type, title, eyebrow, createLabel, transformAction, transformLabel }: Props) {
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [openRowIndex, setOpenRowIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fromQuoteId, setFromQuoteId] = useState<string | null>(null);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [business, setBusiness] = useState<TenantBusinessConfiguration | null>(null);
  const showFabricationFields = isFabricationProfile(business);

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

  useEffect(() => {
    const token = getAccessToken();
    if (token) void getCompanyBranding(token).then(setBranding).catch(() => setBranding(null));
    void getTenantBusinessConfiguration().then(setBusiness).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (type !== "proformas") return;
    const quoteId = new URLSearchParams(window.location.search).get("fromQuote");
    if (!quoteId) return;
    setFromQuoteId(quoteId);
    void (async () => {
      const response = await apiFetch(`/quotes/${quoteId}`);
      if (!response.ok) return;
      const quote = await response.json();
      setCustomerId(quote.customerId ?? "");
      setDocumentTitle(quote.title ?? "");
      setExpectedDate(quote.expectedDate ? String(quote.expectedDate).slice(0, 10) : "");
      setNotes(quote.notes ?? "");
      setGlobalDiscount(0);
      const quoteLines: Line[] = (quote.items ?? []).map((item: DocumentItem) => ({
        productId: item.product?.id,
        customName: item.customName ?? undefined,
        customNote: item.customNote ?? undefined,
        label: item.product?.name ?? item.customName ?? "",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        tax: Number(item.tax)
      }));
      setLines(quoteLines.length ? quoteLines : [emptyLine()]);
      setMessage("Lignes du devis chargées. Vous pouvez les modifier avant de créer la commande.");
    })();
  }, [apiFetch, type]);

  const searchProducts = useCallback(async (term: string) => {
    if (!term.trim()) return;
    const query = new URLSearchParams({ limit: "20", search: term.trim() });
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

  const activeQuery = openRowIndex !== null ? lines[openRowIndex]?.label ?? "" : "";
  useEffect(() => {
    const timer = window.setTimeout(() => void searchProducts(activeQuery), 250);
    return () => window.clearTimeout(timer);
  }, [activeQuery, searchProducts]);

  const totalPreview = useMemo(() => {
    return Math.max(0, lines.reduce((sum, line) => sum + lineTotal(line), 0) - globalDiscount);
  }, [globalDiscount, lines]);

  function updateLine(index: number, next: Line) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? next : line)));
  }

  function pickProduct(index: number, product: Product) {
    updateLine(index, { ...lines[index], productId: product.id, customName: undefined, label: product.name, unitPrice: Number(product.salePrice ?? 0) });
    setOpenRowIndex(null);
  }

  function addRow() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeRow(index: number) {
    setLines((current) => (current.length > 1 ? current.filter((_, lineIndex) => lineIndex !== index) : [emptyLine()]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const validLines = lines.filter((line) => line.productId || line.label.trim());
    if (validLines.length === 0) {
      setMessage(`Ajoutez au moins une ligne au ${documentName(type)}.`);
      return;
    }
    setLoading(true);
    const items = validLines.map((line) => ({
      productId: line.productId,
      customName: line.productId ? undefined : line.label.trim(),
      customType: line.productId ? undefined : "SERVICE",
      customNote: (showFabricationFields ? composeFabricationNote(line) : undefined) ?? line.customNote,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      tax: line.tax
    }));
    const response = fromQuoteId
      ? await apiFetch(`/quotes/${fromQuoteId}/to-proforma`, { method: "POST", body: JSON.stringify({ items, title: documentTitle || undefined, expectedDate: expectedDate || undefined }) })
      : await apiFetch(`/${type}`, {
          method: "POST",
          body: JSON.stringify({ customerId: customerId || undefined, title: documentTitle || undefined, expectedDate: expectedDate || undefined, notes, discount: globalDiscount, items })
        });
    setLoading(false);
    if (response.ok) {
      setLines([emptyLine()]);
      setNotes("");
      setDocumentTitle("");
      setExpectedDate("");
      setGlobalDiscount(0);
      setMessage(fromQuoteId ? "Commande créée depuis le devis, stock sorti." : `${createLabel} enregistré.`);
      setFromQuoteId(null);
      await loadDocuments();
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Enregistrement impossible.");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {type === "quotes"
            ? "Le devis prépare un prix imprimable. Il ne modifie pas le stock et ne crée pas de vente POS."
            : type === "proformas"
              ? "La commande sort le stock à la création et suit Total, Avance et Balance jusqu'à la vente terminée."
              : "Document finalisé issu d'une commande soldée."}
        </p>
        {message ? <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p> : null}
      </section>

      <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">{branding?.companyInitials ?? "ME"}</div>
            )}
            <div>
              <p className="font-bold text-slate-950 dark:text-white">{branding?.companyName ?? "Mon entreprise"}</p>
              <p className="text-xs text-slate-500">{createTitle(type)}</p>
            </div>
          </div>
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-full rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:w-64">
            <option value="">Client comptoir / facultatif</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName ?? customer.name}</option>)}
          </select>
        </div>

        <div className="grid gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            Titre {showFabricationFields ? "(ex: Fenêtres salon + porte cuisine)" : "(facultatif)"}
            <input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Titre du projet" className="rounded-md border px-3 py-2 text-sm font-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
          {showFabricationFields ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Date de livraison/installation prévue
              <input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </label>
          ) : null}
        </div>

        <div className="overflow-x-auto p-5 pb-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="p-2">Produit / description</th>
                <th className="p-2 w-24">Quantité</th>
                <th className="p-2 w-28">Prix</th>
                <th className="p-2 w-24">Remise</th>
                <th className="p-2 w-28 text-right">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const suggestions = openRowIndex === index ? matchingProducts(products, line.label) : [];
                return (
                  <Fragment key={index}>
                  <tr className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="relative p-2">
                      <input
                        value={line.label}
                        onChange={(event) => updateLine(index, { ...line, label: event.target.value, productId: undefined })}
                        onFocus={() => setOpenRowIndex(index)}
                        onBlur={() => window.setTimeout(() => setOpenRowIndex((current) => (current === index ? null : current)), 150)}
                        placeholder="Rechercher un produit ou décrire un service"
                        className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                      />
                      {suggestions.length > 0 ? (
                        <div className="absolute left-2 top-full z-20 mt-1 w-80 overflow-auto rounded-md border bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          {suggestions.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => pickProduct(index, product)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <span className="font-medium text-slate-950 dark:text-white">{product.name}</span>
                              <span className="whitespace-nowrap text-xs text-slate-500">{money(product.salePrice)} · Stock {product.stockCurrent ?? "--"}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-2"><Cell value={line.quantity} min="0.01" onChange={(quantity) => updateLine(index, { ...line, quantity })} /></td>
                    <td className="p-2"><Cell value={line.unitPrice} min="0" onChange={(unitPrice) => updateLine(index, { ...line, unitPrice })} /></td>
                    <td className="p-2"><Cell value={line.discount} min="0" onChange={(discount) => updateLine(index, { ...line, discount })} /></td>
                    <td className="p-2 pt-4 text-right font-semibold text-slate-950 dark:text-white">{money(lineTotal(line))}</td>
                    <td className="p-2 pt-3 text-center">
                      <button type="button" onClick={() => removeRow(index)} title="Retirer la ligne" className="text-slate-400 hover:text-red-600">×</button>
                    </td>
                  </tr>
                  {showFabricationFields ? (
                    <tr className="border-t border-dashed border-slate-100 dark:border-slate-800">
                      <td colSpan={6} className="p-2">
                        <button type="button" onClick={() => updateLine(index, { ...line, showFabDetails: !line.showFabDetails })} className="text-xs font-semibold text-brand-600 hover:underline">
                          {line.showFabDetails ? "− Masquer les détails fabrication" : "+ Détails fabrication (type, matériau, mesures, couleur)"}
                        </button>
                        {line.showFabDetails ? (
                          <div className="mt-2">
                          <p className="mb-1 text-xs font-semibold text-slate-500">Notes de mesure</p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                            <select value={line.fabWorkType ?? ""} onChange={(event) => updateLine(index, { ...line, fabWorkType: event.target.value })} className="rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950">
                              <option value="">Type de travail</option>
                              {FABRICATION_WORK_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                            <select value={line.fabMaterial ?? ""} onChange={(event) => updateLine(index, { ...line, fabMaterial: event.target.value })} className="rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950">
                              <option value="">Matériau</option>
                              {FABRICATION_MATERIALS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                            <input value={line.fabWidth ?? ""} onChange={(event) => updateLine(index, { ...line, fabWidth: event.target.value })} placeholder="Largeur (cm)" className="rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
                            <input value={line.fabHeight ?? ""} onChange={(event) => updateLine(index, { ...line, fabHeight: event.target.value })} placeholder="Hauteur (cm)" className="rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
                            <input value={line.fabLength ?? ""} onChange={(event) => updateLine(index, { ...line, fabLength: event.target.value })} placeholder="Longueur (cm)" className="rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
                            <input value={line.fabColor ?? ""} onChange={(event) => updateLine(index, { ...line, fabColor: event.target.value })} placeholder="Couleur" className="rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
                            <input value={line.fabGlass ?? ""} onChange={(event) => updateLine(index, { ...line, fabGlass: event.target.value })} placeholder="Épaisseur / verre (ex: 6mm)" className="col-span-2 rounded-md border px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
                          </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <button type="button" onClick={addRow} className="mt-2 rounded-md border border-dashed px-3 py-2 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300">+ Ajouter une ligne</button>
        </div>

        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <label className="grid w-full gap-1 text-xs font-semibold text-slate-500 sm:max-w-sm">
            {showFabricationFields ? "Livraison / installation" : "Notes"}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={showFabricationFields ? "Instructions de livraison, accès, contact sur place..." : "Notes"} className="min-h-20 w-full rounded-md border px-3 py-2 text-sm font-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
          <div className="grid w-full gap-2 sm:w-64">
            <NumberInput label="Remise globale" value={globalDiscount} onChange={setGlobalDiscount} />
            <SummaryBox label="Total" value={money(totalPreview)} />
            {type === "proformas" ? (
              <>
                <SummaryBox label="Avance" value={money(0)} />
                <SummaryBox label="Balance" value={money(totalPreview)} />
              </>
            ) : null}
          </div>
        </div>

        <div className="border-t border-slate-100 p-5 dark:border-slate-800">
          <button disabled={loading} className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">{loading ? "Enregistrement..." : createLabel}</button>
        </div>
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
            <DocumentCard key={document.id} document={document} type={type} transformLabel={transformLabel} showTransform={Boolean(transformAction)} showFabricationFields={showFabricationFields} />
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
              <tr>
                <th className="p-3">Numéro</th>
                <th className="p-3">Client</th>
                <th className="p-3">Total</th>
                {type !== "quotes" ? <th className="p-3">Avance</th> : null}
                {type !== "quotes" ? <th className="p-3">Balance</th> : null}
                <th className="p-3">Statut</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-3 font-mono text-xs">{document.documentNumber ?? document.number}</td>
                  <td className="p-3">{document.customer?.displayName ?? document.customer?.name ?? "--"}</td>
                  <td className="p-3">{money(document.total)}</td>
                  {type !== "quotes" ? <td className="p-3">{money(document.paidAmount)}</td> : null}
                  {type !== "quotes" ? <td className="p-3">{money(document.balance)}</td> : null}
                  <td className="p-3"><StatusBadge status={document.status} paymentStatus={document.paymentStatus} showFabricationFields={showFabricationFields} /></td>
                  <td className="p-3"><DocumentActions document={document} type={type} transformLabel={transformLabel} showTransform={Boolean(transformAction)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Cell({ value, min, onChange }: { value: number; min: string; onChange: (value: number) => void }) {
  return <input type="number" min={min} step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-md border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />;
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-500">
      {label}
      <input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} className="rounded-md border px-3 py-2 text-sm font-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
    </label>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="font-bold">{value}</p></div>;
}

function DocumentCard(props: { document: SalesDocument; type: DocType; transformLabel?: string; showTransform: boolean; showFabricationFields?: boolean }) {
  const { document, type, showFabricationFields } = props;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-500">{document.documentNumber ?? document.number}</p>
          <h3 className="font-semibold text-slate-950 dark:text-white">{document.customer?.displayName ?? document.customer?.name ?? "Client non défini"}</h3>
        </div>
        <StatusBadge status={document.status} paymentStatus={document.paymentStatus} showFabricationFields={showFabricationFields} />
      </div>
      <div className={`mt-3 grid gap-2 text-sm ${type === "quotes" ? "grid-cols-1" : "grid-cols-3"}`}>
        <SummaryBox label="Total" value={money(document.total)} />
        {type !== "quotes" ? <SummaryBox label="Avance" value={money(document.paidAmount)} /> : null}
        {type !== "quotes" ? <SummaryBox label="Balance" value={money(document.balance)} /> : null}
      </div>
      <div className="mt-3"><DocumentActions {...props} /></div>
    </article>
  );
}

function DocumentActions({ document, type, transformLabel, showTransform }: { document: SalesDocument; type: DocType; transformLabel?: string; showTransform: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/dashboard/sales/${type}/${document.id}`} className="rounded-md border px-3 py-2 text-xs font-semibold">Voir</Link>
      <Link href={`/dashboard/sales/${type}/${document.id}`} className="rounded-md border px-3 py-2 text-xs font-semibold">Imprimer</Link>
      {type === "quotes" && showTransform ? (
        <Link href={`/dashboard/sales/proformas/create?fromQuote=${document.id}`} className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white">{transformLabel ?? "Convertir en commande"}</Link>
      ) : null}
    </div>
  );
}

function StatusBadge({ status, paymentStatus, showFabricationFields }: { status: string; paymentStatus?: string | null; showFabricationFields?: boolean }) {
  const label = paymentStatus && paymentStatus !== "UNPAID" ? `${statusLabel(status, showFabricationFields)} · ${statusLabel(paymentStatus, showFabricationFields)}` : statusLabel(status, showFabricationFields);
  return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{label}</span>;
}

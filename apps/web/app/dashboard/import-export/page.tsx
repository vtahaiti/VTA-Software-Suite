"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";
import { getAccessToken } from "@/lib/auth";
import { downloadAuthenticatedFile } from "@/lib/authenticated-download";


type Analysis = {
  headers: string[];
  mapping: Record<string, string>;
  preview: Array<Record<string, unknown>>;
  totalRows: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  ignoredCount: number;
  errors: Array<{ line: number; field?: string; message: string; value?: string }>;
  duplicates: Array<{ line: number; field?: string; message: string; value?: string }>;
  errorReport?: string;
};

const productFields = [
  ["", "Ignorer"],
  ["sku", "Code / SKU"],
  ["name", "Produit / Nom"],
  ["category", "Catégorie"],
  ["stock", "Stock / Quantité"],
  ["purchasePrice", "Prix d'achat"],
  ["salePrice", "Prix de vente"],
  ["supplier", "Fournisseur"],
  ["barcode", "Code-barres"],
  ["minimumStock", "Stock faible / Stock minimum"],
  ["description", "Description"]
];

const exportTargets = [
  ["products", "Produits", "export.products"],
  ["customers", "Clients", "export.customers"],
  ["suppliers", "Fournisseurs", "export.suppliers"],
  ["inventory/stock", "Inventaire", "export.inventory"],
  ["inventory/movements", "Mouvements de stock", "export.inventory"],
  ["inventory/low-stock", "Stock faible", "export.inventory"],
  ["sales", "Ventes et historique", "export.sales"],
  ["purchases", "Achats", "export.purchases"],
  ["reports/summary", "Rapports", "export.reports"]
];

export default function ImportExportPage() {
  const token = useMemo(() => getAccessToken(), []);
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<"ignore" | "update">("ignore");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function readFile(selected: File) {
    const lowerName = selected.name.toLowerCase();
    if (lowerName.endsWith(".xlsx")) {
      const buffer = await selected.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return { fileName: selected.name, format: "XLSX", contentBase64: base64 };
    }
    const content = await selected.text();
    return { fileName: selected.name, format: "CSV", content };
  }

  async function analyze(nextMapping?: Record<string, string>) {
    if (!token || !file) return;
    setLoading(true);
    setMessage("");
    setResult(null);
    try {
      const basePayload = payload ?? await readFile(file);
      setPayload(basePayload);
      const response = await fetch(`${apiUrl}/import-export/products/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...basePayload, mapping: nextMapping ?? mapping, duplicateStrategy })
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json() as Analysis;
      setAnalysis(data);
      setMapping(data.mapping ?? {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analyse impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!token || !payload) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/import-export/products/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, mapping, duplicateStrategy })
      });
      if (!response.ok) throw new Error(await response.text());
      setResult(await response.json());
      setMessage("Import terminé.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import impossible.");
    } finally {
      setLoading(false);
    }
  }

  function updateMapping(header: string, value: string) {
    const next = { ...mapping, [header]: value };
    if (!value) delete next[header];
    setMapping(next);
  }

  function downloadErrorReport() {
    if (!analysis?.errorReport) return;
    const url = URL.createObjectURL(new Blob([analysis.errorReport], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rapport-erreurs-import.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadFile(path: string, fileName: string) {
    setMessage("");
    try {
      await downloadAuthenticatedFile(`${apiUrl}${path}`, fileName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Téléchargement impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Import / export</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Données commerciales</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Importez des produits CSV/XLSX avec aperçu et correspondance des colonnes. Les exports respectent le tenant et les permissions.</p>
      </section>

      {message ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">{message}</div> : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Importer des produits</h2>
              <p className="text-sm text-slate-500">CSV UTF-8, CSV BOM, séparateurs virgule/point-virgule/tabulation, ou XLSX.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void downloadFile("/import-export/products/template/csv", "modele-produits.csv")} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700"><Download className="h-4 w-4" /> Modèle CSV</button>
              <button type="button" onClick={() => void downloadFile("/import-export/products/template/xlsx", "modele-produits.xlsx")} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700"><FileSpreadsheet className="h-4 w-4" /> Modèle XLSX</button>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700 md:grid-cols-[1fr_auto]">
            <input type="file" accept=".csv,.xlsx" onChange={(event) => { const selected = event.target.files?.[0] ?? null; setFile(selected); setPayload(null); setAnalysis(null); setResult(null); }} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <button disabled={!file || loading} onClick={() => void analyze()} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Upload className="h-4 w-4" /> Analyser</button>
          </div>

          {analysis ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label="Lignes" value={analysis.totalRows} />
                <Metric label="Importables" value={analysis.successCount} />
                <Metric label="Doublons" value={analysis.duplicateCount} />
                <Metric label="Erreurs" value={analysis.failedCount} />
              </div>

              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">Correspondance des colonnes</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {analysis.headers.map((header) => (
                    <label key={header} className="grid gap-1 text-sm">
                      <span className="font-medium">{header}</span>
                      <select value={mapping[header] ?? ""} onChange={(event) => updateMapping(header, event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                        {productFields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <button disabled={loading} onClick={() => void analyze(mapping)} className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700"><RefreshCw className="h-4 w-4" /> Revalider</button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Doublons SKU / code-barres</span>
                  <select value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value as "ignore" | "update")} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                    <option value="ignore">Ignorer les doublons</option>
                    <option value="update">Mettre à jour les doublons</option>
                  </select>
                </label>
                <button disabled={loading || (!analysis.successCount && duplicateStrategy === "ignore")} onClick={() => void confirmImport()} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">Confirmer l&apos;import</button>
                <button disabled={!analysis.errorReport} onClick={downloadErrorReport} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">Rapport erreurs</button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950"><tr>{Object.keys(analysis.preview[0] ?? { line: "" }).map((key) => <th key={key} className="px-3 py-2 text-left">{key}</th>)}</tr></thead>
                  <tbody>{analysis.preview.map((row, index) => <tr key={index} className="border-t border-slate-100 dark:border-slate-800">{Object.keys(analysis.preview[0] ?? { line: "" }).map((key) => <td key={key} className="px-3 py-2">{String(row[key] ?? "")}</td>)}</tr>)}</tbody>
                </table>
              </div>

              {result ? <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-white">{JSON.stringify(result, null, 2)}</pre> : null}
            </div>
          ) : null}
        </div>

        <aside className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Exports</h2>
          <p className="text-sm text-slate-500">CSV compatible Excel et XLSX réel.</p>
          {exportTargets.map(([path, label]) => (
            <div key={path} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <p className="font-semibold">{label}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void downloadFile(`/import-export/${path}/export/csv`, `${path.replaceAll("/", "-")}.csv`)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">CSV</button>
                <button type="button" onClick={() => void downloadFile(`/import-export/${path}/export/xlsx`, `${path.replaceAll("/", "-")}.xlsx`)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">XLSX</button>
              </div>
            </div>
          ))}
        </aside>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-950 dark:text-white">{value}</p></div>;
}


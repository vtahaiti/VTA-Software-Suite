"use client";
import { ChangeEvent, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ImportTarget = "products" | "customers" | "suppliers";
type ImportResult = { entity: string; totalRows: number; successCount: number; failedCount: number; successes: Array<{ line: number; id: string; label: string }>; errors: Array<{ line: number; field?: string; message: string; value?: string }>; errorReport: string };
type ImportConfig = { key: ImportTarget; title: string; description: string; sample: string };

const imports: ImportConfig[] = [
  { key: "products", title: "Import Produits", description: "Colonnes conseillees : name, sku, barcode, purchasePrice, salePrice, minimumStock.", sample: "name,sku,barcode,purchasePrice,salePrice,minimumStock\nProduit demo,SKU-DEMO,123456789012,50,75,5" },
  { key: "customers", title: "Import Clients", description: "Colonnes conseillees : displayName, phone, email, city, currentBalance.", sample: "displayName,phone,email,city,currentBalance\nClient demo,+50900000000,client@example.com,Port-au-Prince,0" },
  { key: "suppliers", title: "Import Fournisseurs", description: "Colonnes conseillees : name, code, phone, email, primaryContact, balance.", sample: "name,code,phone,email,primaryContact,balance\nFournisseur demo,SUP-DEMO,+50900000000,fournisseur@example.com,Contact demo,0" }
];

const exportGroups = [
  { title: "Export Produits", endpoints: [{ label: "CSV", path: "products/export/csv" }, { label: "Excel", path: "products/export/excel" }] },
  { title: "Export Clients", endpoints: [{ label: "CSV", path: "customers/export/csv" }, { label: "Excel", path: "customers/export/excel" }] },
  { title: "Export Fournisseurs", endpoints: [{ label: "CSV", path: "suppliers/export/csv" }, { label: "Excel", path: "suppliers/export/excel" }] },
  { title: "Export Inventaire", endpoints: [{ label: "Stock CSV", path: "inventory/stock/export/csv" }, { label: "Stock Excel", path: "inventory/stock/export/excel" }, { label: "Mouvements CSV", path: "inventory/movements/export/csv" }, { label: "Alertes CSV", path: "inventory/low-stock/export/csv" }] }
];

export default function ImportExportPage() {
  const [target, setTarget] = useState<ImportTarget>("products");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const previewRows = useMemo(() => content.split(/\r?\n/).filter(Boolean).slice(0, 6), [content]);
  const selected = imports.find((item) => item.key === target) ?? imports[0];

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);
    setMessage("");
    if (!file) return;
    setFileName(file.name);
    if (file.name.endsWith(".xlsx")) {
      setMessage("Import Excel prepare : utilisez temporairement un export CSV pour importer les donnees.");
      setContent("");
      return;
    }
    setContent(await file.text());
  }

  async function submitImport() {
    setIsLoading(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch(`${apiUrl}/import-export/${target}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        body: JSON.stringify({ content, fileName, format: fileName.endsWith(".xlsx") ? "EXCEL" : "CSV" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Import impossible.");
      setResult(data as ImportResult);
      setMessage("Import termine.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur pendant l'import.");
    } finally {
      setIsLoading(false);
    }
  }

  async function downloadExport(path: string) {
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/import-export/${path}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      if (!response.ok) throw new Error("Export impossible.");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const file = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? "export.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur pendant l'export.");
    }
  }

  function downloadErrorReport() {
    if (!result?.errorReport) return;
    const blob = new Blob([result.errorReport], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapport-erreurs-${target}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function useSample() {
    setFileName(`${target}-exemple.csv`);
    setContent(selected.sample);
    setResult(null);
    setMessage("Exemple charge pour apercu.");
  }

  return <div className="space-y-6">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Donnees</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Import / Export</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Importer et exporter les produits, clients, fournisseurs et donnees d&apos;inventaire.</p></div>
    {message ? <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">{message}</div> : null}
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><h2 className="text-lg font-bold text-slate-950 dark:text-white">Importer un fichier</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Formats acceptes : CSV maintenant, Excel prepare.</p></div><button onClick={useSample} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Charger un exemple</button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3"><label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Type de donnees<select value={target} onChange={(event) => { setTarget(event.target.value as ImportTarget); setResult(null); }} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">{imports.map((item) => <option key={item.key} value={item.key}>{item.title.replace("Import ", "")}</option>)}</select></label><label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">Fichier CSV / Excel<input type="file" accept=".csv,.xlsx" onChange={readFile} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label></div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{selected.description}</p><div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800"><div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-950">Apercu avant import</div>{previewRows.length ? <pre className="max-h-56 overflow-auto p-3 text-xs text-slate-700 dark:text-slate-200">{previewRows.join("\n")}</pre> : <div className="p-4 text-sm text-slate-500">Aucun fichier charge.</div>}</div>
        <button disabled={!content || isLoading} onClick={() => void submitImport()} className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isLoading ? "Import en cours..." : "Importer"}</button>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-bold text-slate-950 dark:text-white">Resultat import</h2>{result ? <div className="mt-4 space-y-3 text-sm"><div className="grid grid-cols-3 gap-2"><Stat label="Lignes" value={result.totalRows} /><Stat label="Reussies" value={result.successCount} /><Stat label="Echouees" value={result.failedCount} /></div>{result.errors.length ? <button onClick={downloadErrorReport} className="rounded-md border border-red-300 px-3 py-2 font-semibold text-red-700 dark:border-red-800 dark:text-red-300">Telecharger le rapport d&apos;erreurs</button> : <p className="text-emerald-600">Aucune erreur detectee.</p>}<div className="max-h-52 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">{result.errors.map((error, index) => <div key={index} className="border-b border-slate-100 p-2 text-xs dark:border-slate-800">Ligne {error.line} - {error.field ?? "general"} : {error.message}</div>)}</div></div> : <p className="mt-4 text-sm text-slate-500">Le resultat apparaitra ici apres import.</p>}</div>
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{exportGroups.map((group) => <div key={group.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-base font-bold text-slate-950 dark:text-white">{group.title}</h2><div className="mt-4 flex flex-wrap gap-2">{group.endpoints.map((endpoint) => <button key={endpoint.path} onClick={() => void downloadExport(endpoint.path)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">{endpoint.label}</button>)}</div></div>)}</section>
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold text-slate-950 dark:text-white">{value}</p></div>; }
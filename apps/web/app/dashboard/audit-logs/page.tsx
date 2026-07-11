"use client";

import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const modules = ["", "Auth", "Products", "Customers", "Suppliers", "Inventory", "Sales", "Invoices", "Payments", "Stores", "Warehouses", "Settings"];
const actions = ["", "LOGIN", "LOGOUT", "LOGIN_FAILED", "CREATE_PRODUCT", "UPDATE_PRODUCT", "DELETE_PRODUCT", "CREATE_CUSTOMER", "UPDATE_CUSTOMER", "CREATE_INVOICE", "CREATE_PAYMENT", "UPDATE_SETTINGS"];

type AuditLog = {
  id: string;
  tenantName?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userPhotoUrl?: string | null;
  action: string;
  entity: string;
  message: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  browser?: string | null;
  operatingSystem?: string | null;
  createdAt: string;
};

type AuditResponse = { items: AuditLog[]; total: number; page: number; limit: number; pages: number };

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [range, setRange] = useState("7");
  const [q, setQ] = useState("");
  const [user, setUser] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (range !== "all") params.set("dateFrom", dateFromRange(range));
    if (q) params.set("q", q);
    if (user) params.set("user", user);
    if (module) params.set("module", module);
    if (action) params.set("action", action);
    return params.toString();
  }, [action, module, page, q, range, user]);

  useEffect(() => { void load(); }, [queryString]);

  async function load() {
    setIsLoading(true);
    setError("");
    const response = await fetch(apiUrl + "/audit?" + queryString, { headers: { Authorization: "Bearer " + getAccessToken() } });
    if (!response.ok) {
      setError("Impossible de charger le journal d'audit.");
      setLogs([]);
      setIsLoading(false);
      return;
    }
    const data = (await response.json()) as AuditResponse;
    setLogs(data.items ?? []);
    setTotal(data.total ?? 0);
    setIsLoading(false);
  }

  async function exportFile(type: "csv" | "xlsx" | "pdf") {
    const response = await fetch(apiUrl + "/audit/export." + type + "?" + queryString, { headers: { Authorization: "Bearer " + getAccessToken() } });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vta-audit." + type;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-medium text-brand-600">Audit</p>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Historique des actions</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Connexions, modifications, ventes, stocks, factures, paiements et paramètres.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void exportFile("csv")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">CSV</button>
            <button onClick={() => void exportFile("xlsx")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Excel préparé</button>
            <button onClick={() => void exportFile("pdf")} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">PDF préparé</button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3 xl:grid-cols-6">
        <input value={q} onChange={(event) => { setPage(1); setQ(event.target.value); }} placeholder="Recherche instantanée" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <select value={range} onChange={(event) => { setPage(1); setRange(event.target.value); }} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <option value="0">Aujourd&apos;hui</option>
          <option value="7">7 jours</option>
          <option value="30">30 jours</option>
          <option value="all">Toutes les dates</option>
        </select>
        <input value={user} onChange={(event) => { setPage(1); setUser(event.target.value); }} placeholder="Utilisateur" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <select value={module} onChange={(event) => { setPage(1); setModule(event.target.value); }} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          {modules.map((entry) => <option key={entry || "all"} value={entry}>{entry || "Tous les modules"}</option>)}
        </select>
        <select value={action} onChange={(event) => { setPage(1); setAction(event.target.value); }} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          {actions.map((entry) => <option key={entry || "all"} value={entry}>{entry || "Toutes les actions"}</option>)}
        </select>
        <button onClick={() => void load()} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Actualiser</button>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{isLoading ? "Chargement..." : total + " action(s) trouvees"}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
              <tr><th className="p-3">Date</th><th className="p-3">Utilisateur</th><th className="p-3">Entreprise</th><th className="p-3">Module</th><th className="p-3">Action</th><th className="p-3">Description</th><th className="p-3">IP</th><th className="p-3">Détails</th></tr>
            </thead>
            <tbody>{logs.map((log) => <tr key={log.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3">{new Date(log.createdAt).toLocaleString("fr-HT")}</td><td className="p-3"><UserCell log={log} /></td><td className="p-3">{log.tenantName ?? "--"}</td><td className="p-3">{log.entity}</td><td className="p-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{log.action}</span></td><td className="max-w-sm truncate p-3">{log.message}</td><td className="p-3">{log.ipAddress ?? "--"}</td><td className="p-3"><button onClick={() => setSelected(log)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700">Voir détail</button></td></tr>)}</tbody>
          </table>
        </div>
        {!logs.length && !isLoading ? <div className="p-6 text-sm text-slate-500">Aucune action trouvée pour ces filtres.</div> : null}
        {error ? <div className="p-4 text-sm text-red-600">{error}</div> : null}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border px-3 py-1.5 disabled:opacity-50 dark:border-slate-700">Précédent</button>
            <button disabled={logs.length < 50} onClick={() => setPage((current) => current + 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-50 dark:border-slate-700">Suivant</button>
          </div>
        </div>
      </section>

      {selected ? <DetailsModal log={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function UserCell({ log }: { log: AuditLog }) {
  const initials = (log.userName ?? log.userEmail ?? "VT").split(/[\s@]+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "VT";
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {log.userPhotoUrl ? <img src={log.userPhotoUrl} alt="Utilisateur" className="h-full w-full object-cover" /> : initials}
      </span>
      <span className="grid"><span className="font-medium text-slate-800 dark:text-slate-100">{log.userName ?? "Utilisateur"}</span><span className="text-xs text-slate-500">{log.userEmail ?? "--"}</span></span>
    </div>
  );
}

function DetailsModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-600">Détails audit</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{log.action}</h2>
            <p className="mt-1 text-sm text-slate-500">{new Date(log.createdAt).toLocaleString("fr-HT")} - {log.browser ?? "Navigateur inconnu"} - {log.operatingSystem ?? "Système inconnu"}</p>
          </div>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm font-semibold dark:border-slate-700">Fermer</button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ValueBlock title="Anciennes valeurs" value={log.oldValue} />
          <ValueBlock title="Nouvelles valeurs" value={log.newValue} />
        </div>
      </div>
    </div>
  );
}

function ValueBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{value ? JSON.stringify(value, null, 2) : "Aucune valeur enregistrée."}</pre>
    </div>
  );
}

function dateFromRange(range: string) {
  const date = new Date();
  const days = Number(range);
  if (Number.isFinite(days) && days > 0) date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

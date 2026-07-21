"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Bell, CheckCheck, RefreshCw } from "lucide-react";
import { getAccessToken } from "@/lib/auth";


type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  module?: string;
  referenceId?: string;
  link?: string;
  metadata?: {
    reason?: string | null;
  } | null;
  createdAt: string;
  readAt?: string;
};

type NotificationResponse = {
  items: Notification[];
  total: number;
  unread: number;
  page: number;
  limit: number;
  totalPages: number;
};

const statusOptions = [{ value: "", label: "Toutes" }, { value: "unread", label: "Non lues" }, { value: "read", label: "Lues" }, { value: "archived", label: "Archivées" }];
const typeOptions = [{ value: "", label: "Tous types" }, { value: "info", label: "Info" }, { value: "success", label: "Succès" }, { value: "warning", label: "Alerte" }, { value: "error", label: "Erreur" }];

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const token = useMemo(() => getAccessToken(), []);

  const load = useCallback(async (nextPage: number) => {
    if (!token) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(nextPage), limit: "20" });
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (moduleName) params.set("module", moduleName);
    try {
      const response = await fetch(`${apiUrl}/notifications?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Impossible de charger les notifications.");
      const payload = await response.json() as NotificationResponse | Notification[];
      const normalized = Array.isArray(payload) ? { items: payload, total: payload.length, unread: payload.filter((item) => item.status === "UNREAD").length, page: 1, limit: 20, totalPages: 1 } : payload;
      setItems(normalized.items);
      setTotal(normalized.total);
      setUnread(normalized.unread);
      setPage(normalized.page);
      setTotalPages(normalized.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }, [moduleName, status, token, type]);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function patch(path: string, success: string) {
    if (!token) return;
    setMessage("");
    const response = await fetch(`${apiUrl}${path}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    setMessage(response.ok ? success : "Action impossible.");
    await load(page);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600">Centre de notifications</p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Alertes internes : stock, abonnement, imports, sauvegardes et ventes en attente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-200">{unread} non lue{unread > 1 ? "s" : ""}</span>
          <button onClick={() => void patch("/notifications/read-all", "Toutes les notifications sont marquées comme lues.")} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
          </button>
        </div>
      </div>

      {message ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">{message}</div> : null}
      {error ? <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"><span>{error}</span><button onClick={() => void load(page)} className="inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" /> Réessayer</button></div> : null}

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <input value={moduleName} onChange={(event) => setModuleName(event.target.value)} placeholder="Module" className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <button onClick={() => void load(1)} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Filtrer</button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? <div className="p-6 text-sm text-slate-500">Chargement...</div> : null}
        {!loading && !items.length ? <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-slate-500"><Bell className="h-8 w-8" /> Aucune notification.</div> : null}
        {items.map((item) => (
          <div key={item.id} className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800 md:flex-row md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeClass(item.type)}`}>{labelType(item.type)}</span>
                <span className="text-xs text-slate-500">{item.status === "UNREAD" ? "Non lue" : item.status === "READ" ? "Lue" : "Archivée"}</span>
                <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString("fr-HT")}</span>
              </div>
              <h2 className="mt-2 text-base font-bold text-slate-950 dark:text-white">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
              {notificationReason(item) ? <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Motif : {notificationReason(item)}</p> : null}
              <p className="mt-1 text-xs text-slate-400">Module : {item.module ?? "général"} {item.referenceId ? `- Réf. ${item.referenceId}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.link ? <Link href={item.link} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Ouvrir</Link> : null}
              <button disabled={item.status === "READ"} onClick={() => void patch(`/notifications/${item.id}/read`, "Notification marquée comme lue.")} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">Lu</button>
              <button onClick={() => void patch(`/notifications/${item.id}/archive`, "Notification archivée.")} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700"><Archive className="h-4 w-4" /> Archiver</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
        <span>{total} notification{total > 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => void load(page - 1)} className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700">Précédent</button>
          <span className="px-3 py-2">Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => void load(page + 1)} className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700">Suivant</button>
        </div>
      </div>
    </div>
  );
}

function labelType(type: string) {
  const value = type.toLowerCase();
  return value === "success" ? "Succès" : value === "warning" ? "Alerte" : value === "error" ? "Erreur" : "Info";
}
function badgeClass(type: string) {
  const value = type.toLowerCase();
  if (value === "success") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200";
  if (value === "warning") return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200";
  if (value === "error") return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200";
  return "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-200";
}

function notificationReason(item: Notification) {
  const reason = item.metadata?.reason;
  return typeof reason === "string" ? reason.trim() : "";
}

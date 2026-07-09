"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../admin-shell";
import { platformFetch } from "@/lib/platform";

type PlatformLog = { id: string; type: string; tenantName?: string | null; user?: string | null; action: string; message: string; ipAddress?: string | null; userAgent?: string | null; createdAt: string };

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<PlatformLog[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { platformFetch<PlatformLog[]>("/platform/logs").then(setLogs).catch((err) => setError(err.message)); }, []);
  return (
    <AdminShell>
      <div className="mb-5"><h2 className="text-2xl font-black text-white">Securite & Logs plateforme</h2><p className="mt-1 text-sm text-slate-400">Connexions, erreurs critiques, notes internes et evenements plateforme.</p></div>
      {error ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/10"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-4">Date</th><th>Type</th><th>Entreprise</th><th>Utilisateur</th><th>Action</th><th>IP</th><th>Navigateur</th><th>Message</th></tr></thead><tbody>{logs.map((log) => <tr key={`${log.type}-${log.id}`} className="border-t border-white/10 text-slate-300"><td className="p-4 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("fr-HT")}</td><td><span className="rounded-full bg-cyan-400/15 px-2 py-1 text-xs font-bold text-cyan-100">{log.type}</span></td><td>{log.tenantName ?? "Plateforme"}</td><td>{log.user ?? "-"}</td><td className="font-bold text-white">{log.action}</td><td>{log.ipAddress ?? "-"}</td><td className="max-w-[220px] truncate">{log.userAgent ?? "-"}</td><td>{log.message}</td></tr>)}</tbody></table></div>
    </AdminShell>
  );
}

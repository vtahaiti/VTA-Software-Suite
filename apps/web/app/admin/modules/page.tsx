"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../admin-shell";
import { platformFetch } from "@/lib/platform";

type ModuleRow = { key: string; name: string; category: string; activeTenants: number; permissions: number };

export default function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { platformFetch<ModuleRow[]>("/platform/modules").then(setModules).catch((err) => setError(err.message)); }, []);
  return <AdminShell><div className="mb-5"><h2 className="text-2xl font-black text-white">Modules metier</h2><p className="mt-1 text-sm text-slate-400">Activation globale observee par module. L&apos;activation par entreprise se fait dans le detail tenant.</p></div>{error ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map((module) => <div key={module.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{module.category}</p><h3 className="mt-2 text-lg font-black text-white">{module.name}</h3><p className="mt-1 text-xs text-slate-500">{module.key}</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-950/40 p-3"><p className="text-slate-500">Entreprises actives</p><b className="text-white">{module.activeTenants}</b></div><div className="rounded-xl bg-slate-950/40 p-3"><p className="text-slate-500">Permissions</p><b className="text-white">{module.permissions}</b></div></div></div>)}</div></AdminShell>;
}


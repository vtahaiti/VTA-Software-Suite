"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";


type Permission = { id: string; key: string; name: string; category: string; description?: string };
type Role = { id: string; name: string; description?: string | null; isSystem?: boolean; permissions?: Array<{ permission: Permission }> };

export default function PermissionsSettingsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setError("");
    const headers = { Authorization: "Bearer " + getAccessToken() };
    const [permissionsResponse, rolesResponse] = await Promise.all([
      fetch(apiUrl + "/permissions", { headers }),
      fetch(apiUrl + "/roles", { headers })
    ]);
    if (permissionsResponse.ok) setPermissions(await permissionsResponse.json());
    else setError("Impossible de charger les permissions.");
    if (rolesResponse.ok) setRoles(await rolesResponse.json());
  }

  const categories = useMemo(() => [...new Set(permissions.map((permission) => permission.category))].sort(), [permissions]);
  const filtered = useMemo(() => permissions.filter((permission) => {
    const text = (permission.key + " " + permission.name + " " + (permission.description ?? "")).toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!category || permission.category === category);
  }), [category, permissions, query]);
  const grouped = useMemo(() => filtered.reduce<Record<string, Permission[]>>((groups, permission) => {
    groups[permission.category] = [...(groups[permission.category] ?? []), permission];
    return groups;
  }, {}), [filtered]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Paramètres avancés</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Permissions</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Les permissions système sont gérées par VTA Commerce et ne doivent pas être créées librement depuis l&apos;interface. Utilisez cette page pour contrôler les clés, les familles et la matrice rôles ? permissions.
        </p>
      </section>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_240px_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une permission" className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <option value="">Toutes les familles</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button onClick={() => void load()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Actualiser</button>
      </section>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
              <tr><th className="p-3">Permission</th><th className="p-3">Famille</th>{roles.map((role) => <th key={role.id} className="p-3 text-center">{displayRole(role.name)}</th>)}</tr>
            </thead>
            <tbody>{filtered.map((permission) => <tr key={permission.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3"><p className="font-semibold text-slate-900 dark:text-white">{permission.name}</p><p className="font-mono text-xs text-slate-500">{permission.key}</p></td><td className="p-3">{permission.category}</td>{roles.map((role) => <td key={role.id} className="p-3 text-center"><span className={role.permissions?.some((entry) => entry.permission.key === permission.key) ? "text-emerald-600" : "text-slate-300"}>{role.permissions?.some((entry) => entry.permission.key === permission.key) ? "✓" : "—"}</span></td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="grid gap-5 md:grid-cols-2">
        {Object.entries(grouped).map(([group, items]) => <div key={group} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold text-slate-950 dark:text-white">{group}</h2><div className="mt-3 space-y-2">{items.map((permission) => <div key={permission.id} className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"><p className="font-medium text-slate-950 dark:text-white">{permission.name}</p><p className="text-xs text-slate-500">{permission.key}</p>{permission.description ? <p className="mt-1 text-xs text-slate-500">{permission.description}</p> : null}</div>)}</div></div>)}
      </section>
    </div>
  );
}

function displayRole(role: string) {
  const normalized = role.toUpperCase();
  if (normalized === "OWNER") return "Propriétaire";
  if (normalized === "ADMIN") return "Admin";
  if (normalized === "CASHIER" || normalized === "CAISSIER") return "Caissier";
  return role;
}

"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/role-access";

type UserRow = { id: string; name: string; email: string; phone?: string; role: string; roles: string[]; isActive: boolean; createdAt: string };
type RoleRow = { id: string; name: string; description?: string };
type StoreRow = { id: string; name: string };
type PaginatedStores = { items?: StoreRow[] };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const roleLabels: Record<string, string> = { OWNER: "Propriétaire", ADMIN: "Administrateur", CAISSIER: "Caissier", STOCK: "Stock", COMPTABLE: "Comptable", MANAGER: "Manager", Owner: "Propriétaire" };
const defaultRoles: RoleRow[] = [
  { id: "OWNER", name: "OWNER" },
  { id: "ADMIN", name: "ADMIN" },
  { id: "CAISSIER", name: "CAISSIER" },
  { id: "STOCK", name: "STOCK" },
  { id: "COMPTABLE", name: "COMPTABLE" },
  { id: "MANAGER", name: "MANAGER" }
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", temporaryPassword: "", role: "CAISSIER", storeId: "" });
  const currentUser = getCurrentUser();
  const canManage = canManageUsers(currentUser);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const token = getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [usersResponse, rolesResponse, storesResponse] = await Promise.all([
        fetch(`${apiUrl}/users`, { headers }),
        fetch(`${apiUrl}/users/roles`, { headers }),
        fetch(`${apiUrl}/stores`, { headers }).catch(() => null)
      ]);

      if (usersResponse.ok) {
        const data = await usersResponse.json();
        setUsers(Array.isArray(data) ? data : []);
      }

      if (rolesResponse.ok) {
        const data = await rolesResponse.json();
        const nextRoles = Array.isArray(data) ? data.filter((role: RoleRow) => ["OWNER", "ADMIN", "CAISSIER", "STOCK", "COMPTABLE", "MANAGER", "Owner"].includes(role.name)) : [];
        setRoles(nextRoles.length ? nextRoles : defaultRoles);
      } else {
        setRoles(defaultRoles);
      }

      if (storesResponse?.ok) {
        const data = await storesResponse.json() as StoreRow[] | PaginatedStores;
        setStores(Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      setUsers([]);
      setRoles(defaultRoles);
      setStores([]);
      setMessage("Impossible de charger les utilisateurs pour le moment.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(`${apiUrl}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ ...form, storeId: form.storeId || undefined })
    });
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }
    setForm({ name: "", email: "", phone: "", temporaryPassword: "", role: "CAISSIER", storeId: "" });
    setMessage("Utilisateur ajouté avec succès.");
    await load();
  }

  async function updateRole(userId: string, role: string) {
    const response = await fetch(`${apiUrl}/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ role })
    });
    setMessage(response.ok ? "Rôle modifié." : await readError(response));
    await load();
  }

  async function disableUser(userId: string) {
    const response = await fetch(`${apiUrl}/users/${userId}/disable`, { method: "PATCH", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    setMessage(response.ok ? "Utilisateur désactivé." : await readError(response));
    await load();
  }

  const activeCount = useMemo(() => users.filter((user) => user.isActive).length, [users]);

  if (!canManage) {
    return <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Accès réservé</h1>
      <p className="mt-2 text-sm text-slate-500">Seuls les propriétaires et administrateurs peuvent gérer les rôles et utilisateurs.</p>
    </section>;
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Administration entreprise</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Rôles & Utilisateurs</h1>
          <p className="mt-1 text-sm text-slate-500">Ajoutez les employés, attribuez leur rôle et bloquez les comptes inactifs.</p>
        </div>
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-slate-950 dark:text-brand-200">{activeCount} utilisateurs actifs, propriétaire inclus</div>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Ajouter un utilisateur</h2>
        <div className="mt-4 space-y-3">
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nom complet" className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Téléphone" className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input required type="password" minLength={8} value={form.temporaryPassword} onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} placeholder="Mot de passe temporaire" className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            {availableRoles(roles).map((role) => <option key={role.id} value={role.name}>{roleLabels[role.name] ?? role.name}</option>)}
          </select>
          <select value={form.storeId} onChange={(event) => setForm({ ...form, storeId: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Tous les magasins autorisés</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Créer utilisateur</button>
          {message ? <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
              <tr><th className="px-4 py-3">Utilisateur</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((user) => <tr key={user.id}>
                <td className="px-4 py-3"><p className="font-semibold text-slate-950 dark:text-white">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.phone || "-"}</td>
                <td className="px-4 py-3"><select value={normalizeRole(user.role)} onChange={(event) => updateRole(user.id, event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950">{availableRoles(roles, user.role).map((role) => <option key={role.id} value={role.name}>{roleLabels[role.name] ?? role.name}</option>)}</select></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{user.isActive ? "Actif" : "Désactivé"}</span></td>
                <td className="px-4 py-3"><button disabled={!user.isActive || user.id === currentUser?.id} onClick={() => disableUser(user.id)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Désactiver</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Historique des accès</h2>
      <p className="mt-2 text-sm text-slate-500">Les connexions et déconnexions sont enregistrées dans Sécurité et Audit. Cette section reste volontairement simple pour le mode quotidien.</p>
    </section>
  </div>;
}

function availableRoles(roles: RoleRow[], currentRole?: string) {
  const normalizedCurrent = normalizeRole(currentRole);
  const base = (roles.length ? roles : defaultRoles).filter((role) => role.name !== "Owner");
  if (base.some((role) => role.name === normalizedCurrent)) return base;
  return normalizedCurrent ? [{ id: normalizedCurrent, name: normalizedCurrent }, ...base] : base;
}

function normalizeRole(role?: string | null) {
  const map: Record<string, string> = { Owner: "OWNER", Administrator: "ADMIN", Cashier: "CAISSIER", Inventory: "STOCK", Accountant: "COMPTABLE", Manager: "MANAGER" };
  if (!role) return "CAISSIER";
  return map[role] ?? role;
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Opération impossible.";
  } catch {
    return "Opération impossible.";
  }
}

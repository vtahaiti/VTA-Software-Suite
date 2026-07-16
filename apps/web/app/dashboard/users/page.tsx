"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { PasswordVisibilityInput } from "@/components/password-visibility-input";
import { canManageUsers } from "@/lib/role-access";

type UserRow = { id: string; name: string; email: string; phone?: string; role: string; roles: string[]; isActive: boolean; createdAt: string };
type RoleRow = { id: string; name: string; description?: string };
type StoreRow = { id: string; name: string };
type PaginatedStores = { items?: StoreRow[] };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const tenantRoleNames = ["OWNER", "ADMIN", "CAISSIER", "STOCK", "COMPTABLE", "MANAGER", "OBSERVATEUR", "BASIC"];
const roleLabels: Record<string, string> = { OWNER: "Proprietaire", ADMIN: "Administrateur", CAISSIER: "Caissier", STOCK: "Stock", COMPTABLE: "Comptable", MANAGER: "Manager", OBSERVATEUR: "Observateur", BASIC: "Utilisateur basique", Owner: "Proprietaire" };
const defaultRoles: RoleRow[] = [
  { id: "OWNER", name: "OWNER" },
  { id: "ADMIN", name: "ADMIN" },
  { id: "CAISSIER", name: "CAISSIER" },
  { id: "STOCK", name: "STOCK" },
  { id: "COMPTABLE", name: "COMPTABLE" },
  { id: "MANAGER", name: "MANAGER" },
  { id: "OBSERVATEUR", name: "OBSERVATEUR" },
  { id: "BASIC", name: "BASIC" }
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", temporaryPassword: "", role: "CAISSIER", storeId: "" });
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
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
        const nextRoles = Array.isArray(data) ? data.filter((role: RoleRow) => [...tenantRoleNames, "Owner"].includes(role.name)) : [];
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
    setMessage("Utilisateur ajoute avec succes.");
    await load();
  }

  async function updateRole(userId: string, role: string) {
    const response = await fetch(`${apiUrl}/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ role })
    });
    setMessage(response.ok ? "Role modifie." : await readError(response));
    await load();
  }

  async function disableUser(userId: string) {
    const response = await fetch(`${apiUrl}/users/${userId}/disable`, { method: "PATCH", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    setMessage(response.ok ? "Utilisateur desactive." : await readError(response));
    await load();
  }

  async function reactivateUser(userId: string) {
    const response = await fetch(`${apiUrl}/users/${userId}/reactivate`, { method: "PATCH", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    setMessage(response.ok ? "Utilisateur reactive." : await readError(response));
    await load();
  }

  async function resetUserPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget) return;
    if (!window.confirm(`Changer le mot de passe de ${passwordTarget.name} ?`)) return;
    const response = await fetch(`${apiUrl}/users/${passwordTarget.id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ temporaryPassword })
    });
    if (response.ok) {
      setMessage("Mot de passe temporaire mis a jour.");
      setPasswordTarget(null);
      setTemporaryPassword("");
      return;
    }
    setMessage(await readError(response));
  }

  const activeCount = useMemo(() => users.filter((user) => user.isActive).length, [users]);

  if (!canManage) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Acces reserve</h1>
        <p className="mt-2 text-sm text-slate-500">Seuls les proprietaires et administrateurs peuvent gerer les roles et utilisateurs.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Administration entreprise</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Roles & Utilisateurs</h1>
            <p className="mt-1 text-sm text-slate-500">Ajoutez les employes, attribuez leur role, reactivez un compte ou changez un mot de passe temporaire.</p>
          </div>
          <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-slate-950 dark:text-brand-200">{activeCount} utilisateurs actifs, proprietaire inclus</div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Ajouter un utilisateur</h2>
          <div className="mt-4 space-y-3">
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nom complet" className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Telephone" className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <PasswordVisibilityInput required minLength={8} value={form.temporaryPassword} onChange={(value) => setForm({ ...form, temporaryPassword: value })} placeholder="Mot de passe temporaire" autoComplete="new-password" className="rounded-lg py-2" />
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              {availableRoles(roles).map((role) => <option key={role.id} value={role.name}>{roleLabels[role.name] ?? role.name}</option>)}
            </select>
            <select value={form.storeId} onChange={(event) => setForm({ ...form, storeId: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="">Tous les magasins autorises</option>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
            <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Creer utilisateur</button>
            {message ? <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                <tr><th className="px-4 py-3">Utilisateur</th><th className="px-4 py-3">Telephone</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-950 dark:text-white">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <select value={normalizeRole(user.role)} onChange={(event) => void updateRole(user.id, event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
                        {availableRoles(roles, user.role).map((role) => <option key={role.id} value={role.name}>{roleLabels[role.name] ?? role.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{user.isActive ? "Actif" : "Desactive"}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.isActive ? (
                          <button disabled={user.id === currentUser?.id} onClick={() => void disableUser(user.id)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Desactiver</button>
                        ) : (
                          <button onClick={() => void reactivateUser(user.id)} className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300">Reactiver</button>
                        )}
                        <button onClick={() => { setPasswordTarget(user); setTemporaryPassword(""); }} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Mot de passe</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {passwordTarget ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Changer le mot de passe</h2>
          <p className="mt-1 text-sm text-slate-500">Utilisateur : {passwordTarget.name}. Communiquez le mot de passe temporaire directement a la personne concernee.</p>
          <form onSubmit={resetUserPassword} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <PasswordVisibilityInput required minLength={8} maxLength={120} value={temporaryPassword} onChange={setTemporaryPassword} placeholder="Nouveau mot de passe temporaire" autoComplete="new-password" className="min-w-0 flex-1 rounded-lg py-2" />
            <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Enregistrer</button>
            <button type="button" onClick={() => { setPasswordTarget(null); setTemporaryPassword(""); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Annuler</button>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Historique des acces</h2>
        <p className="mt-2 text-sm text-slate-500">Les connexions et deconnexions sont enregistrees dans Securite et Audit. Cette section reste volontairement simple pour le mode quotidien.</p>
      </section>
    </div>
  );
}

function availableRoles(roles: RoleRow[], currentRole?: string) {
  const normalizedCurrent = normalizeRole(currentRole);
  const base = (roles.length ? roles : defaultRoles).filter((role) => role.name !== "Owner");
  if (base.some((role) => role.name === normalizedCurrent)) return base;
  return normalizedCurrent ? [{ id: normalizedCurrent, name: normalizedCurrent }, ...base] : base;
}

function normalizeRole(role?: string | null) {
  const map: Record<string, string> = { Owner: "OWNER", Administrator: "ADMIN", Cashier: "CAISSIER", Inventory: "STOCK", Accountant: "COMPTABLE", Manager: "MANAGER", Observer: "OBSERVATEUR", ReadOnly: "OBSERVATEUR", Basic: "BASIC" };
  if (!role) return "CAISSIER";
  return map[role] ?? role;
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Operation impossible.";
  } catch {
    return "Operation impossible.";
  }
}

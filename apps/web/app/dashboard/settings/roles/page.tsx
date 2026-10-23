"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { IosSheet } from "@/components/ios-sheet";
import { IosPageHeading } from "@/components/ios-page-heading";
type Permission = { id: string; key: string; name: string; category: string };
type Role = { id: string; name: string; description?: string; permissions?: { permission: Permission }[] };
export default function RolesSettingsPage() {
  const [roles,setRoles]=useState<Role[]>([]); const [permissions,setPermissions]=useState<Permission[]>([]); const [name,setName]=useState(""); const [description,setDescription]=useState(""); const [selectedPermissionIds,setSelectedPermissionIds]=useState<string[]>([]); const [selectedRole,setSelectedRole]=useState<Role|null>(null); const [message,setMessage]=useState<string|null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  useEffect(()=>{void loadData();},[]);
  async function loadData() {
    setLoading(true); setLoadError("");
    try {
      const headers = { Authorization: `Bearer ${getAccessToken()}` };
      const [r, p] = await Promise.all([fetch(`${apiUrl}/roles`, { headers }), fetch(`${apiUrl}/permissions`, { headers })]);
      if (!r.ok || !p.ok) throw new Error();
      const [roleData, permissionData] = await Promise.all([r.json(), p.json()]);
      setRoles(roleData); setPermissions(permissionData);
    } catch { setLoadError("Impossible de charger les rôles et permissions. Réessayez."); }
    finally { setLoading(false); }
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || loading || loadError || !name.trim()) return;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(selectedRole ? `${apiUrl}/roles/${selectedRole.id}` : `${apiUrl}/roles`, {
        method: selectedRole ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        body: JSON.stringify({ name: name.trim(), description, permissionIds: selectedPermissionIds })
      });
      if (!response.ok) throw new Error();
      setName(""); setDescription(""); setSelectedPermissionIds([]); setSelectedRole(null); setEditing(false);
      setMessage("Rôle enregistré avec succès."); await loadData();
    } catch { setMessage("Impossible d’enregistrer le rôle. Vérifiez votre connexion puis réessayez."); }
    finally { setSaving(false); }
  }
  function editRole(role:Role){setEditing(true);setMessage(null);setSelectedRole(role);setName(role.name);setDescription(role.description??"");setSelectedPermissionIds(role.permissions?.map((item)=>item.permission.id)??[]);}
  const grouped=useMemo(()=>permissions.reduce<Record<string,Permission[]>>((groups,permission)=>{groups[permission.category]=[...(groups[permission.category]??[]),permission];return groups;},{}),[permissions]);
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1") return <div className="vm-screen vm-settings-screen">
    <IosPageHeading title="Rôles et accès" />
    <p className="vm-form-help">Définissez les accès de chaque membre de votre équipe.</p>
    <button type="button" className="vm-primary-button" disabled={loading || Boolean(loadError)} onClick={() => { setSelectedRole(null); setName(""); setDescription(""); setSelectedPermissionIds([]); setMessage(null); setEditing(true); }}>+ Créer un rôle</button>
    {loading ? <p role="status">Chargement des rôles…</p> : loadError ? <div role="alert" className="vm-settings-notice">{loadError}<button type="button" onClick={() => void loadData()}>Réessayer</button></div> : <section className="vm-settings-cards">{roles.length ? roles.map(role => <button key={role.id} className="vm-role-row" onClick={() => editRole(role)}><span className="vm-role-badge">{role.name.slice(0,1).toUpperCase()}</span><span><strong>{role.name}</strong><small>{role.description || "Accès personnalisés"}</small><em>{role.permissions?.length ?? 0} permissions</em></span><span aria-hidden="true">›</span></button>) : <p className="vm-settings-notice">Aucun rôle. Créez le premier rôle de votre équipe.</p>}</section>}
    {!editing && message && <p role="status" className="vm-settings-notice">{message}</p>}
    {editing && <IosSheet title={selectedRole ? "Modifier le rôle" : "Nouveau rôle"} subtitle="Choisissez uniquement les accès nécessaires." onClose={() => { if (!saving) setEditing(false); }}><form onSubmit={handleSubmit} className="vm-settings-form"><fieldset disabled={saving}><label>Nom du rôle<input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Responsable boutique" /></label><label>Description <small>Facultatif</small><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}/></label><div className="vm-permission-heading"><h3>Permissions</h3><span>{selectedPermissionIds.length} sélectionnées</span></div>{Object.entries(grouped).map(([category, items]) => <details key={category} className="vm-permission-group"><summary>{category}<span>{items.filter(p => selectedPermissionIds.includes(p.id)).length}/{items.length}</span></summary>{items.map(permission => <label key={permission.id} className="vm-permission-choice"><span>{permission.name}</span><input type="checkbox" checked={selectedPermissionIds.includes(permission.id)} onChange={e => setSelectedPermissionIds(current => e.target.checked ? [...current, permission.id] : current.filter(id => id !== permission.id))}/></label>)}</details>)}{message && <p role="alert" className="vm-field-error">{message}</p>}<button type="submit" className="vm-primary-button" disabled={saving || !name.trim()}>{saving ? "Enregistrement…" : "Enregistrer le rôle"}</button></fieldset></form></IosSheet>}
  </div>;
  return <div className="grid gap-6 xl:grid-cols-[360px_1fr]"><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Paramètres</p><h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Rôles</h1><form className="mt-5 space-y-4" onSubmit={handleSubmit}><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nom du rôle" className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Description" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><button className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{selectedRole?"Modifier":"Créer"}</button>{message?<p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>:null}</form></section><section className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{roles.map((role)=><button key={role.id} onClick={()=>editRole(role)} className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-600 dark:border-slate-800 dark:bg-slate-900"><p className="font-semibold text-slate-950 dark:text-white">{role.name}</p><p className="mt-1 text-sm text-slate-500">{role.description??"Aucune description"}</p><p className="mt-3 text-xs text-brand-600">{role.permissions?.length??0} permissions</p></button>)}</div><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Attribuer les permissions</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{Object.entries(grouped).map(([category,items])=><div key={category}><p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{category}</p><div className="space-y-2">{items.map((permission)=><label key={permission.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={selectedPermissionIds.includes(permission.id)} onChange={(e)=>setSelectedPermissionIds((current)=>e.target.checked?[...current,permission.id]:current.filter((id)=>id!==permission.id))}/>{permission.name}</label>)}</div></div>)}</div></div></section></div>;
}

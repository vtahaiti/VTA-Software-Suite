"use client";

import { FormEvent, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

type Item = { id: string; name: string; symbol?: string; imageUrl?: string | null; icon?: string | null; isActive: boolean };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function ReferenceManager({ title, endpoint, withSymbol = false }: { title: string; endpoint: string; withSymbol?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [icon, setIcon] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const isCategory = endpoint === "categories";

  useEffect(() => { void load(); }, []);

  async function load() {
    const response = await fetch(`${apiUrl}/products/${endpoint}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (response.ok) setItems(await response.json());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`${apiUrl}/products/${endpoint}${editingId ? `/${editingId}` : ""}`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ name, symbol: symbol || undefined, imageUrl: imageUrl || undefined, icon: icon || undefined })
    });
    setMessage(response.ok ? (editingId ? "Catégorie modifiée." : "Catégorie créée.") : await readError(response));
    if (response.ok) {
      resetForm();
      await load();
    }
  }

  async function remove(id: string) {
    setMessage(null);
    const response = await fetch(`${apiUrl}/products/${endpoint}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    setMessage(response.ok ? "Catégorie supprimée." : await readError(response));
    if (response.ok) await load();
  }

  function edit(item: Item) {
    setEditingId(item.id);
    setName(item.name);
    setSymbol(item.symbol ?? "");
    setImageUrl(item.imageUrl ?? "");
    setIcon(item.icon ?? "");
  }

  function resetForm() {
    setEditingId("");
    setName("");
    setSymbol("");
    setImageUrl("");
    setIcon("");
  }

  return <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Produits</p>
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        {withSymbol ? <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Symbole" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /> : null}
        {isCategory ? <>
          <label className="grid gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Choisir une image
            <input type="file" accept="image/*" onChange={(event) => void loadImage(event.target.files?.[0], setImageUrl)} className="sr-only" />
            {imageUrl ? <span className="text-xs font-normal text-green-600">Image sélectionnée</span> : <span className="text-xs font-normal text-slate-400">Facultatif</span>}
          </label>
          <input value={icon} onChange={(event) => setIcon(event.target.value)} placeholder="Icône facultative" className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        </> : null}
        <button className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{editingId ? "Modifier" : "Créer"}</button>
        {editingId ? <button type="button" onClick={resetForm} className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Annuler</button> : null}
        {message ? <p className="text-sm text-slate-500">{message}</p> : null}
      </form>
    </section>
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-12 w-12 rounded-md object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-lg dark:bg-slate-800">{item.icon || item.name.slice(0, 1)}</div>}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-950 dark:text-white">{item.name}</p>
              {item.symbol ? <p className="text-sm text-slate-500">{item.symbol}</p> : null}
              <p className="mt-2 text-xs text-brand-600">{item.isActive ? "Actif" : "Inactif"}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => edit(item)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Modifier</button>
            <button onClick={() => void remove(item.id)} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 dark:border-red-900">Supprimer</button>
          </div>
        </div>)}
      </div>
    </section>
  </div>;
}

function loadImage(file: File | undefined, onDone: (value: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result));
  reader.readAsDataURL(file);
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Action impossible.";
}

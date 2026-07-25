"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";

type Patient = { id: string; customerCode: string; displayName: string; phone?: string; mobile?: string; email?: string; notes?: string | null };

export default function ClinicPatientsPage() {
  const [items, setItems] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function load() {
    setIsLoading(true);
    setError("");
    const params = new URLSearchParams({ page: "1", limit: "50", sortBy: "displayName", sortOrder: "asc" });
    if (search) params.set("search", search);
    const response = await fetchWithAuth(`${apiUrl}/customers?${params}`).catch(() => null);
    setIsLoading(false);
    if (!response?.ok) { setError("Impossible de charger les patients."); return; }
    const data = await response.json();
    setItems(data.items ?? []);
  }

  function startEdit(patient: Patient) {
    setEditingId(patient.id);
    setDraftNote(patient.notes ?? "");
  }

  async function saveNote(id: string) {
    setSavingId(id);
    try {
      const response = await fetchWithAuth(`${apiUrl}/customers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: draftNote }) });
      if (!response.ok) { setError("Enregistrement impossible."); return; }
      setItems((current) => current.map((item) => item.id === id ? { ...item, notes: draftNote } : item));
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Clinique</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Patients</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Fiche patient avec note médicale libre et historique des consultations facturées. Aucune donnée médicale structurée n&apos;est stockée séparément — utilisez la note pour le suivi.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un patient" className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
      {isLoading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement...</div> : null}

      {!isLoading ? (
        <div className="grid gap-4">
          {items.map((patient) => (
            <div key={patient.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950 dark:text-white">{patient.displayName}</p>
                  <p className="text-xs text-slate-500">{patient.customerCode}{patient.phone ? ` · ${patient.phone}` : ""}{patient.mobile ? ` · ${patient.mobile}` : ""}{patient.email ? ` · ${patient.email}` : ""}</p>
                </div>
                <Link href={`/dashboard/customers/${patient.id}/statement`} className="rounded-md border px-3 py-2 text-xs font-semibold dark:border-slate-700">Historique des consultations</Link>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">Note médicale</p>
                {editingId === patient.id ? (
                  <div className="mt-1 space-y-2">
                    <textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Allergies, antécédents, traitements en cours..." />
                    <div className="flex gap-2">
                      <button onClick={() => void saveNote(patient.id)} disabled={savingId === patient.id} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{savingId === patient.id ? "Enregistrement..." : "Enregistrer"}</button>
                      <button onClick={() => setEditingId(null)} className="rounded-md border px-3 py-1.5 text-xs font-semibold dark:border-slate-700">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startEdit(patient)} className="mt-1 block w-full rounded-md border border-dashed border-slate-300 px-3 py-2 text-left text-sm text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300">
                    {patient.notes || "Ajouter une note médicale..."}
                  </button>
                )}
              </div>
            </div>
          ))}
          {!items.length ? <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Aucun patient trouvé.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

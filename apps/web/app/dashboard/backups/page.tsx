"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Backup = { id: string; status: string; filePath?: string; fileSize: number; userEmail?: string; message?: string; createdAt: string };

export default function BackupsPage() {
  const [items, setItems] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch(apiUrl + "/backups", { headers: { Authorization: "Bearer " + getAccessToken() } });
    if (response.ok) setItems(await response.json());
    else setError("Impossible de charger l&apos;historique des sauvegardes.");
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Sauvegarde</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Sauvegardes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Historique des sauvegardes préparées. La création manuelle est masquée tant que le chiffrement, le stockage hors serveur, la restauration isolée et la vérification d&apos;intégrité ne sont pas validés.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Une sauvegarde n&apos;est considérée fonctionnelle qu&apos;après une restauration testée dans un environnement isolé. Aucun bouton de création n&apos;est affiché pour éviter une fausse sécurité.
        </div>
      </section>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
              <tr><th className="p-3">Date</th><th className="p-3">Statut</th><th className="p-3">Utilisateur</th><th className="p-3">Taille</th><th className="p-3">Chemin préparé</th><th className="p-3">Message</th></tr>
            </thead>
            <tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3">{new Date(item.createdAt).toLocaleString("fr-HT")}</td><td className="p-3">{item.status}</td><td className="p-3">{item.userEmail ?? "--"}</td><td className="p-3">{item.fileSize} octets</td><td className="p-3 font-mono text-xs">{item.filePath ?? "--"}</td><td className="p-3">{item.message ?? "--"}</td></tr>)}</tbody>
          </table>
        </div>
        {!loading && !items.length ? <div className="p-6 text-sm text-slate-500">Aucune sauvegarde enregistrée.</div> : null}
        {loading ? <div className="p-6 text-sm text-slate-500">Chargement...</div> : null}
      </section>
    </div>
  );
}

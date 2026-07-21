"use client";

import { useEffect, useState } from "react";
import { apiUnavailableMessage, fetchApi } from "@/lib/api-url";

type Status = "disponible" | "indisponible" | "vérification";

export default function LocalStatusPage() {
  const [api, setApi] = useState<Status>("vérification");
  const [checkedAt, setCheckedAt] = useState<string>("");

  async function check() {
    setApi("vérification");
    setCheckedAt(new Date().toLocaleString("fr-HT"));
    try {
      const response = await fetchApi("/health", { cache: "no-store" });
      setApi(response.ok ? "disponible" : "indisponible");
    } catch {
      setApi("indisponible");
    }
  }

  useEffect(() => {
    void check();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">VTA Commerce</p>
        <h1 className="mt-3 text-3xl font-bold">État de connexion</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Dernière vérification : {checkedAt || "en cours"}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card label="Web chargé" status="disponible" detail="Oui, l’interface VTA est chargée." />
          <Card label="API VTA" status={api} detail={api === "indisponible" ? apiUnavailableMessage : "Le service VTA répond normalement."} />
        </div>
        <button type="button" onClick={() => void check()} className="mt-6 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          Réessayer
        </button>
        {api === "indisponible" ? (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-semibold">Connexion momentanément impossible</p>
            <p className="mt-2">{apiUnavailableMessage}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Card({ label, status, detail }: { label: string; status: Status; detail: string }) {
  const color = status === "disponible" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200" : status === "indisponible" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return <article className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold ${color}`}>{status}</p><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detail}</p></article>;
}

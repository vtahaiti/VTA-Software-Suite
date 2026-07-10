"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Status = "OK" | "KO" | "Verification";

export default function LocalStatusPage() {
  const [api, setApi] = useState<Status>("Verification");
  const [database, setDatabase] = useState<Status>("Verification");
  const [checkedAt, setCheckedAt] = useState<string>("");

  useEffect(() => {
    async function check() {
      setCheckedAt(new Date().toLocaleString("fr-HT"));
      try {
        const response = await fetch(`${apiUrl}/health`, { cache: "no-store" });
        setApi(response.ok ? "OK" : "KO");
      } catch {
        setApi("KO");
      }
      try {
        const response = await fetch(`${apiUrl}/health/database`, { cache: "no-store" });
        setDatabase(response.ok ? "OK" : "KO");
      } catch {
        setDatabase("KO");
      }
    }
    void check();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">VTA ERP local</p>
        <h1 className="mt-3 text-3xl font-bold">Etat de l acces local</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Derniere verification : {checkedAt || "en cours"}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card label="Web" status="OK" detail="Cette page est chargee sur localhost:3000." />
          <Card label="API" status={api} detail="Verification de http://localhost:3001/health." />
          <Card label="Base de donnees" status={database} detail="Verification PostgreSQL via l API." />
        </div>
        {(api === "KO" || database === "KO") ? (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-semibold">Que faire ?</p>
            <p className="mt-2">Lancez <code>npm run local:stop</code>, puis <code>npm run local:start</code>. Si PostgreSQL est KO, verifiez que PostgreSQL ecoute sur le port 5432 ou lancez <code>docker compose up -d</code>.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Card({ label, status, detail }: { label: string; status: Status; detail: string }) {
  const color = status === "OK" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200" : status === "KO" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return <article className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold ${color}`}>{status}</p><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detail}</p></article>;
}
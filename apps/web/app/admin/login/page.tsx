"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isPlatformAdmin, platformLogin } from "@/lib/platform";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@vtaerp.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isPlatformAdmin()) router.replace("/admin/dashboard");
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await platformLogin({ email, password, rememberMe: true });
      router.push("/admin/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setIsLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#07111f] px-4 text-slate-100">
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl shadow-black/30">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">VTA ERP</p>
      <h1 className="mt-2 text-3xl font-black text-white">Control Center</h1>
      <p className="mt-2 text-sm text-slate-400">Connexion reservee au SUPER_ADMIN VTA.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="grid gap-2 text-sm font-semibold">Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-300" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">Mot de passe
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-300" />
        </label>
        {error ? <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}
        <button disabled={isLoading} className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{isLoading ? "Connexion..." : "Ouvrir le Control Center"}</button>
      </form>
    </section>
  </main>;
}

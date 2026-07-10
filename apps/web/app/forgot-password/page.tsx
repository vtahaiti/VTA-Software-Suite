"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.includes("@")) {
      setError("Veuillez saisir une adresse email valide.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestPasswordReset({ email });
      setMessage(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de traiter la demande pour le moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 px-6 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl flex-col items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/15 bg-white p-8 text-slate-950 shadow-2xl shadow-slate-950/30 dark:bg-slate-900 dark:text-white">
          <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-brand-600">VTA Commerce</Link>
          <h1 className="mt-4 text-3xl font-bold">Mot de passe oublié</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Saisissez votre email. Si un compte existe, vous recevrez les instructions pour réinitialiser votre mot de passe.
          </p>

          <form method="post" onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Email
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                required
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
              />
            </div>

            {error ? <div role="alert" aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            {message ? <div role="status" aria-live="polite" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Envoi..." : "Envoyer les instructions"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-300">
            Vous vous souvenez du mot de passe ? <Link href="/login" className="font-semibold text-brand-600">Se connecter</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

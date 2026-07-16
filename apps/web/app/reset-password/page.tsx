"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth";
import { PasswordVisibilityInput } from "@/components/password-visibility-input";
import { isPasswordStrong, passwordPolicyMessage } from "@/lib/password-policy";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordShell><p className="text-sm text-slate-600 dark:text-slate-300">Chargement du lien sécurisé...</p></ResetPasswordShell>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Lien de réinitialisation invalide ou expiré.");
      return;
    }
    if (!isPasswordStrong(password)) {
      setError(passwordPolicyMessage);
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword({ token, newPassword: password, confirmPassword });
      setMessage(result.message);
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState(null, "", "/login?reset=success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de réinitialiser le mot de passe.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ResetPasswordShell>
      <form method="post" onSubmit={submit} className="mt-8 space-y-5">
        <input type="hidden" name="token" value={token} />
        <PasswordVisibilityInput label="Nouveau mot de passe" name="newPassword" required autoComplete="new-password" value={password} onChange={setPassword} />
        <PasswordVisibilityInput label="Confirmer le mot de passe" name="confirmPassword" required autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />

        {error ? <div role="alert" aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div role="status" aria-live="polite" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div> : null}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Réinitialisation..." : "Réinitialiser"}
        </button>
      </form>
    </ResetPasswordShell>
  );
}

function ResetPasswordShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 px-6 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl flex-col items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/15 bg-white p-8 text-slate-950 shadow-2xl shadow-slate-950/30 dark:bg-slate-900 dark:text-white">
          <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-brand-600">VTA Commerce</Link>
          <h1 className="mt-4 text-3xl font-bold">Réinitialiser le mot de passe</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{passwordPolicyMessage}</p>
          {children}
        </div>
      </section>
    </main>
  );
}

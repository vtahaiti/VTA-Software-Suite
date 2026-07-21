"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { publicApiErrorMessage } from "@/lib/api-url";
import { registerUser } from "@/lib/auth";
import { PasswordVisibilityInput } from "@/components/password-visibility-input";
import { isPasswordStrong, passwordPolicyMessage } from "@/lib/password-policy";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", acceptedTerms: false });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.acceptedTerms) {
      setError("Vous devez accepter les conditions d’utilisation et la politique de confidentialité pour continuer.");
      return;
    }

    if (!isPasswordStrong(form.password)) {
      setError(passwordPolicyMessage);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerUser(form);
      window.localStorage.setItem("vta_pending_onboarding", result.pendingToken);
      router.push("/onboarding/company");
    } catch (caught) {
      setError(publicApiErrorMessage(caught, "Inscription impossible."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 dark:bg-slate-950">
      <section className="mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-brand-600">VTA Commerce</Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">Créer votre compte</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Démarrez votre espace SaaS en quelques minutes.</p>
        <form method="post" onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
          <Input label="Prénom" name="firstName" autoComplete="given-name" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} />
          <Input label="Nom" name="lastName" autoComplete="family-name" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} />
          <Input label="Email" name="email" autoComplete="email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Input label="Téléphone" name="phone" autoComplete="tel" type="tel" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <PasswordVisibilityInput label="Mot de passe" name="password" autoComplete="new-password" required value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
          <PasswordVisibilityInput label="Confirmation du mot de passe" name="confirmPassword" autoComplete="new-password" required value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} />
          <p className="sm:col-span-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{passwordPolicyMessage}</p>
          <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              name="acceptedTerms"
              type="checkbox"
              required
              checked={form.acceptedTerms}
              onChange={(event) => setForm({ ...form, acceptedTerms: event.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <span>
              J’accepte les <Link href="/terms" className="font-semibold text-brand-600">conditions d’utilisation</Link> et la{" "}
              <Link href="/privacy" className="font-semibold text-brand-600">politique de confidentialité</Link>.
            </span>
          </label>
          {error ? <div role="alert" aria-live="polite" className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <button disabled={isLoading} className="sm:col-span-2 rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{isLoading ? "Création..." : "Continuer"}</button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-300">Vous avez déjà un compte ? <Link href="/login" className="font-semibold text-brand-600">Se connecter</Link></p>
      </section>
    </main>
  );
}

function Input({
  label,
  name,
  value,
  onChange,
  autoComplete,
  type = "text"
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <input
        required
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

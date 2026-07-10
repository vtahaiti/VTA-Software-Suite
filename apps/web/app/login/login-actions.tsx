"use client";

import Link from "next/link";
import { useState } from "react";
import { LoginForm } from "./login-form";

export function LoginActions() {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return (
      <div className="animate-[fadeIn_240ms_ease-out]">
        <button
          type="button"
          onClick={() => setShowLogin(false)}
          className="mb-5 text-sm font-semibold text-slate-500 transition hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300"
        >
          Retour aux options
        </button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Connexion sécurisée</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Accéder à mon espace</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Connectez-vous pour retrouver votre tableau de bord, vos ventes, vos stocks et vos rapports.
          </p>
        </div>
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_240ms_ease-out]">
      <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Bienvenue !</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Que souhaitez-vous faire ?</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Choisissez votre parcours. Vous pouvez vous connecter à une entreprise existante ou créer gratuitement votre espace VTA Commerce.
      </p>

      <div className="mt-8 grid gap-4">
        <button
          type="button"
          onClick={() => setShowLogin(true)}
          className="group rounded-2xl border border-blue-100 bg-blue-600 p-5 text-left text-white shadow-lg shadow-blue-600/20 transition duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25"
        >
          <span className="text-lg font-bold">J&apos;ai déjà un compte</span>
          <span className="mt-1 block text-sm text-blue-50">Me connecter à mon tableau de bord VTA Commerce.</span>
        </button>

        <Link
          href="/signup"
          className="group rounded-2xl border border-green-100 bg-green-600 p-5 text-left text-white shadow-lg shadow-green-600/20 transition duration-200 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-xl hover:shadow-green-600/25"
        >
          <span className="text-lg font-bold">Créer un compte gratuitement</span>
          <span className="mt-1 block text-sm text-green-50">Démarrer votre entreprise avec un onboarding guidé.</span>
        </Link>
      </div>
    </div>
  );
}

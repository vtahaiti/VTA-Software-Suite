import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 px-6 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-white p-5 shadow-2xl shadow-slate-950/25 ring-1 ring-white/70">
            <Image src="/vta-commerce-logo.png" alt="Logo VTA Commerce" width={88} height={88} priority className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl">VTA Commerce</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-blue-50">
            La plateforme moderne de gestion commerciale conçue pour les entreprises de toutes tailles.
          </p>
        </div>

        <div className="mt-10 w-full max-w-md rounded-[2rem] border border-white/15 bg-white p-8 text-slate-950 shadow-2xl shadow-slate-950/30 dark:bg-slate-900 dark:text-white">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Connexion sécurisée</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Accéder à mon espace</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Connectez-vous pour retrouver votre tableau de bord, vos ventes, vos stocks et vos rapports.
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

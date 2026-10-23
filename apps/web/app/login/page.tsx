import Link from "next/link";
import { VtaBusinessMark } from "@/components/vta-business-mark";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1") return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-md">
        <Link href="/" className="text-sm font-semibold text-[#0877f9]">← Retour au POS</Link>
        <div className="mt-5 flex items-center gap-3"><img src="/vta-pos-icon.svg" alt="" className="h-14 w-14 rounded-xl" /><div><h1 className="text-2xl font-bold">VTA POS</h1><p className="text-sm text-slate-500">Connectez votre entreprise</p></div></div>
        <div className="mt-5 rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-xl font-bold">Se connecter</h2><p className="mt-2 text-sm text-slate-500">Utilisez le même compte que sur VTA ERP et Android.</p><LoginForm /></div>
        <Link href="/account-deletion" className="mt-5 block text-center text-xs underline">Supprimer mon compte</Link>
      </section>
    </main>
  );
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 px-6 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col items-center justify-center">
        <div className="text-center">
          <VtaBusinessMark inverted centered />
          <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl">Gérez votre entreprise avec clarté</h1>
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

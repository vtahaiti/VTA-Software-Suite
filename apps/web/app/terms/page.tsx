import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <h1 className="mt-4 text-3xl font-bold">Conditions d&apos;utilisation</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          VTA Commerce est une application de gestion commerciale destinée aux entreprises. L&apos;utilisateur s&apos;engage à
          fournir des informations exactes, à protéger ses identifiants, à respecter les droits des autres utilisateurs
          et à utiliser le service uniquement pour des activités légales.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Les propriétaires d&apos;entreprise sont responsables des utilisateurs qu&apos;ils invitent, des données saisies dans
          leur espace et des opérations commerciales effectuées depuis leur tenant.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          VTA Commerce peut suspendre un accès en cas de risque de sécurité, d&apos;abus, de non-paiement ou de demande
          administrative justifiée. Les données ne sont pas supprimées automatiquement lors d&apos;une suspension.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/faq" className="text-brand-600">Questions fréquentes</Link>
          <Link href="/privacy" className="text-brand-600">Politique de confidentialité</Link>
          <Link href="/support" className="text-brand-600">Assistance</Link>
          <Link href="/account-deletion" className="text-brand-600">Suppression de compte</Link>
        </div>
      </section>
    </main>
  );
}

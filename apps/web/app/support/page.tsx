import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <h1 className="mt-4 text-3xl font-bold">Assistance</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Pour obtenir de l&apos;aide avec VTA Commerce, contactez l&apos;assistance &agrave; l&apos;adresse
          <a className="font-semibold text-brand-600" href="mailto:support@vtaerp.com"> support@vtaerp.com</a>.
          Indiquez le nom de votre entreprise, votre r&ocirc;le et une description claire du probl&egrave;me. N&apos;envoyez jamais de
          mot de passe, de jeton ou de donn&eacute;es bancaires par email.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Pour les demandes de suspension, de r&eacute;activation, d&apos;abonnement ou de suppression de compte, utilisez le m&ecirc;me
          canal d&apos;assistance afin qu&apos;un suivi soit enregistr&eacute;.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/privacy" className="text-brand-600">Confidentialit&eacute;</Link>
          <Link href="/terms" className="text-brand-600">Conditions</Link>
          <Link href="/account-deletion" className="text-brand-600">Suppression de compte</Link>
        </div>
      </section>
    </main>
  );
}

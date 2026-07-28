import Link from "next/link";

const steps: Array<{ title: string; description: string; href?: string; linkLabel?: string }> = [
  {
    title: "1. Créer votre entreprise",
    description:
      "Inscrivez-vous, choisissez votre secteur d'activité et votre spécialité (market, restaurant, quincaillerie...). VTA adapte automatiquement les modules affichés à votre métier.",
    href: "/signup",
    linkLabel: "Créer mon entreprise"
  },
  {
    title: "2. Ajouter vos produits ou services",
    description:
      "Entrez le nom, le prix de vente et, si besoin, la quantité en stock. Vous pouvez ajouter une photo et une catégorie pour vous retrouver plus facilement."
  },
  {
    title: "3. Inviter vos utilisateurs",
    description:
      "Ajoutez vos employés (caissier, gérant) avec leur propre accès. Chaque utilisateur a un rôle qui définit ce qu'il peut voir ou faire."
  },
  {
    title: "4. Faire votre première vente",
    description:
      "Ouvrez la caisse (POS), recherchez ou scannez un produit, encaissez. Le stock se met à jour automatiquement, et un reçu peut être imprimé ou envoyé."
  },
  {
    title: "5. Consulter vos rapports",
    description:
      "Suivez votre chiffre d'affaires, votre bénéfice et vos produits les plus vendus, jour par jour ou mois par mois, depuis la section Rapports."
  }
];

export default function GettingStartedPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <div className="mt-4 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Comment démarrer</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Cinq étapes simples pour commencer à vendre avec VTA Business, sans expérience technique nécessaire.
          </p>
        </div>

        <ol className="mt-8 space-y-5">
          {steps.map((step) => (
            <li key={step.title} className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{step.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{step.description}</p>
              {step.href ? (
                <Link href={step.href} className="mt-3 inline-block text-sm font-semibold text-brand-600">
                  {step.linkLabel} →
                </Link>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-lg bg-slate-100 p-5 text-sm leading-7 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p>
            Besoin d&apos;aide pour installer VTA dans votre entreprise ? Consultez la{" "}
            <Link href="/faq" className="font-semibold text-brand-600">foire aux questions</Link>{" "}
            ou contactez l&apos;<Link href="/support" className="font-semibold text-brand-600">assistance</Link>.
          </p>
        </div>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm font-semibold" aria-label="Liens utiles">
          <Link href="/faq" className="text-brand-600">Questions fréquentes</Link>
          <Link href="/support" className="text-brand-600">Assistance</Link>
        </nav>
      </section>
    </main>
  );
}

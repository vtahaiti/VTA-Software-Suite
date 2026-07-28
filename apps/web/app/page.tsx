import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Camera,
  Check,
  ChefHat,
  Factory,
  Hammer,
  HardHat,
  Hotel,
  Layers3,
  PackageCheck,
  Phone,
  PillBottle,
  Printer,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Store,
  UsersRound,
  WalletCards,
  Wrench
} from "lucide-react";

export const metadata: Metadata = {
  title: "VTA Business - Caisse, stock et gestion",
  description: "Une plateforme flexible pour gérer ventes, produits, services, stock, clients, paiements, utilisateurs et rapports."
};

const whatsappHref = "https://wa.me/?text=Bonjour%20VTA%20Enterprise%2C%20je%20souhaite%20une%20d%C3%A9monstration%20de%20VTA%20Business.";

const features = [
  { icon: ScanLine, title: "Caisse / POS", text: "Encaissez rapidement et gardez une vente en attente lorsque nécessaire." },
  { icon: PackageCheck, title: "Produits & services", text: "Organisez ce que vous vendez, qu’il s’agisse d’articles ou de services." },
  { icon: Boxes, title: "Stock", text: "Suivez les quantités, les mouvements et les alertes de stock faible." },
  { icon: UsersRound, title: "Clients", text: "Centralisez les coordonnées et le suivi utile de chaque client." },
  { icon: WalletCards, title: "Paiements", text: "Gardez une vue claire sur les montants reçus et ceux qui restent à régler." },
  { icon: ShieldCheck, title: "Utilisateurs", text: "Donnez à chaque employé un accès adapté à son rôle." },
  { icon: BarChart3, title: "Rapports", text: "Consultez les informations essentielles pour suivre votre activité." },
  { icon: Printer, title: "Impression", text: "Imprimez des tickets et documents professionnels depuis vos appareils compatibles." }
];

const activities = [
  { icon: Store, title: "Market / Boutique", text: "Vendez, suivez vos produits et fidélisez vos clients." },
  { icon: Camera, title: "Fashion / Parfumerie", text: "Gérez articles, variantes simples, stock et ventes." },
  { icon: Wrench, title: "Quincaillerie", text: "Gérez articles, unités, stock faible et ventes." },
  { icon: HardHat, title: "Matériaux construction", text: "Suivez sacs, tonnes, mètres, feuilles et inventaire." },
  { icon: ChefHat, title: "Restaurant / Bar / Fast-food", text: "Prenez les commandes, encaissez et suivez votre activité." },
  { icon: Hotel, title: "Hôtel avec restaurant", text: "Suivez clients, paiements, restaurant et activité." },
  { icon: Factory, title: "Fabrication fenêtres / portes", text: "Préparez devis, commandes, avances et balances." },
  { icon: Phone, title: "Téléphones & électronique", text: "Vendez appareils et accessoires, et suivez les services associés." },
  { icon: Hammer, title: "Services & réparation", text: "Suivez les travaux, les clients, les paiements et les balances." },
  { icon: BriefcaseBusiness, title: "Beauté / Salon", text: "Organisez services, clients, produits et paiements." },
  { icon: Building2, title: "Transport / Location", text: "Suivez clients, services, paiements et réservations simples." },
  { icon: PillBottle, title: "Pharmacie / Clinique", text: "Gérez produits ou services, clients et paiements avec prudence." },
  { icon: Layers3, title: "Multi-activité", text: "Regroupez plusieurs branches dans un même espace." },
  { icon: BriefcaseBusiness, title: "Autre activité", text: "Configurez les outils essentiels selon votre fonctionnement." }
];

const benefits = [
  "Simple sur téléphone, tablette et ordinateur",
  "Pensé pour les réalités des entreprises locales",
  "Essai gratuit pour démarrer sereinement",
  "Accès par rôle pour chaque membre de l'équipe",
  "Alertes de stock et suivi des mouvements",
  "Tickets propres et faciles à réimprimer"
];

const plans = [
  { name: "Essentiel", text: "Pour démarrer avec la caisse et les outils essentiels.", accent: "border-blue-600" },
  { name: "Professionnel", text: "Pour une équipe qui veut mieux suivre ses opérations.", accent: "border-orange-500", popular: true },
  { name: "Expert", text: "Pour les entreprises qui veulent une gestion plus complète.", accent: "border-blue-600" }
];

function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${inverted ? "border-white/30 bg-white" : "border-slate-200 bg-white"} shadow-sm`}>
        <svg viewBox="0 0 44 44" className="h-9 w-9" role="img" aria-label="Croissance VTA Business">
          <rect x="4" y="4" width="36" height="36" rx="9" fill="#EFF6FF" />
          <rect x="10" y="23" width="6" height="10" rx="2" fill="#2563EB" />
          <rect x="19" y="17" width="6" height="16" rx="2" fill="#F97316" />
          <rect x="28" y="11" width="6" height="22" rx="2" fill="#1D4ED8" />
          <path d="M10 35.5H35" stroke="#1E3A8A" strokeWidth="2" strokeLinecap="round" />
          <path d="M11 18L20 12.5L27 15L35 8" fill="none" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M31.5 8H35V11.5" fill="none" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        <span className={`block whitespace-nowrap text-lg font-black leading-none ${inverted ? "text-white" : "text-slate-950"}`}>VTA Business</span>
        <span className={`mt-1 block text-[11px] font-semibold ${inverted ? "text-blue-100" : "text-slate-500"}`}>une solution de VTA Enterprise</span>
      </span>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-5xl" aria-label="Aperçu fictif du tableau de bord VTA Business">
      <div className="absolute -left-3 top-10 hidden rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white shadow-lg md:block">Stock faible : 3</div>
      <div className="absolute -right-3 bottom-14 hidden rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-lg md:block">Vente enregistrée</div>
      <div className="overflow-hidden rounded-lg border border-white/25 bg-white text-slate-900 shadow-2xl shadow-slate-950/30">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="ml-2 text-xs font-bold text-slate-600">Tableau de bord</span>
          </div>
          <span className="hidden text-xs font-semibold text-slate-500 sm:block">Aujourd&apos;hui · Port-au-Prince</span>
        </div>
        <div className="grid min-h-[330px] md:grid-cols-[190px_1fr]">
          <aside className="hidden border-r border-slate-200 bg-slate-950 p-4 text-white md:block">
            <div className="mb-6 flex items-center gap-2 text-sm font-black"><Building2 className="h-4 w-4 text-emerald-400" /> Entreprise Démo</div>
            {["Accueil", "Nouvelle vente", "Produits", "Inventaire", "Clients", "Rapports"].map((item, index) => (
              <div key={item} className={`mb-1 rounded-md px-3 py-2 text-xs font-semibold ${index === 0 ? "bg-blue-600 text-white" : "text-slate-300"}`}>{item}</div>
            ))}
          </aside>
          <div className="bg-slate-50 p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-blue-700">Vue d&apos;ensemble</p>
                <p className="mt-1 text-xl font-black">Bonjour, votre activité avance.</p>
              </div>
              <div className="rounded-lg bg-blue-600 p-2 text-white"><BarChart3 className="h-5 w-5" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Ventes du jour", "18 750 G", "text-emerald-700"],
                ["Produits en stock", "248", "text-blue-700"],
                ["Commandes ouvertes", "4", "text-orange-700"],
                ["Clients", "126", "text-slate-900"]
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className={`mt-2 text-lg font-black sm:text-xl ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-black">Activité des ventes</p>
                  <span className="text-[11px] font-bold text-emerald-700">Cette semaine</span>
                </div>
                <div className="flex h-24 items-end gap-2">
                  {[38, 58, 45, 76, 62, 92, 70].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t-sm bg-blue-600" style={{ height: `${height}%`, opacity: 0.45 + index * 0.07 }} />
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm font-black">À surveiller</p>
                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between"><span className="text-slate-600">Stock faible</span><b className="text-orange-600">3 produits</b></div>
                  <div className="flex justify-between"><span className="text-slate-600">Ventes en attente</span><b>2 paniers</b></div>
                  <div className="flex justify-between"><span className="text-slate-600">Top produit</span><b className="text-emerald-700">Eau 20 oz</b></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs font-medium text-blue-100">Aperçu illustratif, sans données client.</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Accueil VTA Business"><BrandMark /></Link>
          <nav className="hidden items-center gap-6 text-sm font-bold text-slate-600 lg:flex" aria-label="Navigation principale">
            <a href="#fonctionnalites" className="hover:text-blue-700">Fonctionnalités</a>
            <a href="#activites" className="hover:text-blue-700">Activités</a>
            <a href="#tarifs" className="hover:text-blue-700">Tarifs</a>
            <Link href="/support" className="hover:text-blue-700">Support</Link>
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Se connecter</Link>
            <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Créer un compte gratuit</Link>
          </div>
          <Link href="/signup" className="rounded-lg bg-blue-600 p-2.5 text-white sm:hidden" aria-label="Créer un compte gratuit"><ArrowRight className="h-5 w-5" /></Link>
        </div>
      </header>

      <section className="overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 px-4 pb-16 pt-16 text-white sm:px-6 sm:pt-20 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-blue-300/40 bg-blue-400/15 px-4 py-2 text-xs font-bold text-blue-100">
            <Smartphone className="h-4 w-4" /> Conçu pour travailler partout, simplement
          </div>
          <h1 className="mx-auto max-w-5xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Une plateforme flexible pour gérer votre entreprise, adaptée à votre activité.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-blue-100 sm:text-xl sm:leading-8">
            VTA Business vous aide à gérer ventes, produits, services, stock, clients, paiements, utilisateurs et rapports depuis téléphone, tablette ou ordinateur.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-black text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500">
              Créer un compte gratuit <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-orange-300 bg-orange-500 px-6 py-3 font-black text-white hover:bg-orange-600">
              Demander une démo WhatsApp
            </a>
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/40 px-6 py-3 font-black text-white hover:bg-white/10">Se connecter</Link>
          </div>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {["POS", "Stock", "Rapports", "Multi-utilisateur", "Impression ticket"].map((item) => (
              <span key={item} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-50">{item}</span>
            ))}
          </div>
          <ProductPreview />
        </div>

        <nav className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-blue-100" aria-label="Liens utiles">
          <Link href="/demarrer" className="transition hover:text-white">Comment démarrer</Link>
          <Link href="/faq" className="transition hover:text-white">Questions fréquentes</Link>
          <Link href="/support" className="transition hover:text-white">Assistance</Link>
          <Link href="/terms" className="transition hover:text-white">Conditions d&apos;utilisation</Link>
          <Link href="/privacy" className="transition hover:text-white">Confidentialité</Link>
        </nav>
      </section>

      <section id="fonctionnalites" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-black uppercase text-blue-700">Tout au même endroit</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Les outils essentiels réunis simplement</h2>
            <p className="mt-4 text-slate-600">Une vue claire de votre activité, sans multiplier les applications ni les cahiers.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className={`rounded-lg border p-5 ${index === 0 ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${index % 3 === 1 ? "bg-orange-500" : index % 4 === 3 ? "bg-emerald-600" : "bg-blue-600"} text-white`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="activites" className="scroll-mt-20 border-y border-slate-200 bg-slate-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-black uppercase text-blue-700">Votre métier, vos besoins</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Adapté à votre activité</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600">VTA Business adapte les outils visibles à votre activité, avec une configuration simple et accompagnée.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activities.map(({ icon: Icon, title, text }) => (
              <article key={title} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-6 w-6" /></div>
                <div><h3 className="font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-950">
            Pour les métiers plus spécialisés comme hôtel, restaurant, fabrication, transport, santé ou garage, VTA Business vous accompagne dans la configuration selon votre fonctionnement réel.
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase text-orange-600">Pratique au quotidien</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Pourquoi les entreprises l’aiment</h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-600">Une interface accessible, des rôles clairs et les informations importantes à portée de main.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {benefits.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                  <span className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-700"><Check className="h-4 w-4" /></span>
                  <span className="text-sm font-bold leading-6">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-blue-700 p-5 text-white shadow-xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/20 pb-5">
              <div><p className="text-sm font-bold text-blue-100">Démonstration</p><p className="mt-1 text-2xl font-black">Votre activité en un coup d’œil</p></div>
              <WalletCards className="h-9 w-9 text-orange-300" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[["Vente du jour", "18 750 G"], ["Stock disponible", "248 produits"], ["Commandes ouvertes", "4"], ["Rapport simple", "+12%"]].map(([label, value], index) => (
                <div key={label} className="rounded-lg bg-white p-4 text-slate-950">
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className={`mt-3 text-lg font-black ${index === 3 ? "text-emerald-700" : ""}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-[#052e3b] p-4">
              <div className="flex items-center justify-between text-sm"><span className="text-blue-100">Objectif hebdomadaire</span><b>74%</b></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[74%] bg-orange-400" /></div>
            </div>
          </div>
        </div>
      </section>

      <section id="tarifs" className="scroll-mt-20 bg-[#f4f8f7] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black uppercase text-blue-700">Des plans qui évoluent avec vous</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Commencez simplement</h2>
            <p className="mt-4 text-slate-600">Choisissez les fonctions adaptées à votre entreprise. Vous pourrez évoluer plus tard.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className={`relative rounded-lg border-t-4 ${plan.accent} border-x border-b border-slate-200 bg-white p-6 shadow-sm`}>
                {plan.popular ? <span className="absolute right-4 top-4 rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">Populaire</span> : null}
                <h3 className="text-xl font-black">{plan.name}</h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{plan.text}</p>
                <Link href="/signup" className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">Commencer</Link>
              </article>
            ))}
          </div>
          <div className="mt-6 text-center"><Link href="/dashboard/settings/subscription" className="text-sm font-black text-blue-700 hover:underline">Voir les plans</Link></div>
        </div>
      </section>

      <section className="bg-blue-700 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-7 text-center lg:flex-row lg:text-left">
          <div><h2 className="text-3xl font-black sm:text-4xl">Prêt à mieux gérer votre entreprise ?</h2><p className="mt-3 font-semibold text-blue-100">Créez votre espace gratuitement ou échangez avec notre équipe.</p></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-6 py-3 font-black text-blue-800 hover:bg-blue-50">Créer un compte gratuit</Link>
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-orange-300 bg-orange-500 px-6 py-3 font-black text-white hover:bg-orange-600">Demander une démo WhatsApp</a>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-end">
          <div><BrandMark inverted /><p className="mt-5 max-w-md text-sm leading-6 text-slate-400">Caisse, stock et gestion pour les entreprises qui veulent avancer avec plus de clarté.</p></div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-slate-300" aria-label="Liens de pied de page">
            <Link href="/support" className="hover:text-white">Support</Link>
            <Link href="/privacy" className="hover:text-white">Confidentialité</Link>
            <Link href="/terms" className="hover:text-white">Conditions</Link>
            <Link href="/account-deletion" className="hover:text-white">Suppression de compte</Link>
          </nav>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-5 text-xs text-slate-500">© {new Date().getFullYear()} VTA Enterprise. Tous droits réservés.</div>
      </footer>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { IosBottomNav } from "@/components/ios-bottom-nav";
import { getAccessToken, getCurrentUser } from "@/lib/auth";

export function PosWelcome() {
  const router = useRouter();
  useEffect(() => {
    if (getCurrentUser() && getAccessToken()) router.replace("/dashboard/pos");
  }, [router]);
  return <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white pb-48">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div><p className="mb-1 text-sm font-extrabold tracking-tight"><span className="text-[#0877f9]">VTA</span> POS</p><h1 className="text-2xl font-bold tracking-tight text-[#111b3c]">Nouvelle vente</h1></div>
      <nav className="flex gap-2" aria-label="Accès au compte"><Link href="/login" className="rounded-lg border px-3 py-2 text-sm font-semibold">Se connecter</Link><Link href="/signup" className="rounded-lg bg-[#0877f9] px-3 py-2 text-sm font-semibold text-white">Créer un compte</Link></nav>
    </header>
    {process.env.NEXT_PUBLIC_IOS_SANDBOX === "1" && <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900">VTA POS Test · Environnement Sandbox · Données séparées de votre entreprise réelle</p>}
    <div className="mx-auto grid max-w-7xl gap-4 p-4 md:grid-cols-[1fr_340px]">
      <section className="min-w-0 space-y-4" aria-labelledby="catalog-title">
        <div><h2 id="catalog-title" className="text-xl font-bold">Produits</h2><p className="mt-1 text-sm text-slate-500">Connectez-vous pour charger le catalogue de votre entreprise.</p></div>
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Rechercher un produit ou scanner son code après connexion</div>
        <div className="flex gap-2"><span className="rounded-full bg-[#0877f9] px-4 py-2 text-sm font-semibold text-white">Tous les produits</span></div>
        <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <svg viewBox="0 0 48 48" aria-hidden="true" className="mb-3 h-12 w-12 text-[#0877f9]" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 16 16-8 16 8v20l-16 8-16-8V16Zm0 0 16 8 16-8M24 24v20M16 12l16 8" /></svg>
          <h3 className="font-semibold">Votre boutique commence ici</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Connectez votre compte VTA pour retrouver vos produits et commencer une vente. Votre caisse reste disponible hors ligne après préparation.</p>
          <Link href="/login" className="mt-4 rounded-lg bg-[#0877f9] px-5 py-3 text-sm font-semibold text-white">Ouvrir ma caisse</Link>
        </div>
      </section>
      <aside className="hidden md:block self-start rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Panier">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Vente en cours</h2><span className="text-xs text-slate-500">0 article</span></div>
        <p className="flex min-h-28 items-center justify-center text-sm text-slate-500">Votre panier est vide</p>
        <div className="space-y-3 border-t pt-4 text-sm dark:border-slate-800"><div className="flex justify-between"><span>Sous-total</span><span>—</span></div><div className="flex justify-between"><span>Taxes</span><span>—</span></div><div className="flex justify-between text-lg font-bold"><span>Total</span><span>—</span></div></div>
        <button disabled className="mt-4 w-full rounded-lg bg-slate-200 px-4 py-3 font-semibold text-slate-500 dark:bg-slate-800">Connectez-vous pour encaisser</button>
      </aside>
    </div>
    <div className="ios-pos-cart"><div className="mb-3 flex justify-between text-sm"><span className="flex items-center gap-2"><ShoppingCart aria-hidden="true" size={22} className="text-blue-600" /><b>0 article</b></span><b>— HTG</b></div><Link href="/login" className="block rounded-xl bg-[#0877f9] py-3 text-center text-sm font-bold text-white">Se connecter pour encaisser</Link></div>
    <IosBottomNav guest />
    <footer className="flex flex-wrap justify-center gap-4 px-4 pb-6 text-xs text-slate-500"><Link href="/privacy">Confidentialité</Link><Link href="/terms">Conditions</Link><Link href="/account-deletion">Supprimer mon compte</Link></footer>
  </main>;
}

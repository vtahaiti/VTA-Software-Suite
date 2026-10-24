"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IosPageHeading } from "./ios-page-heading";
import { appleOfferState } from "@/lib/apple-offer-state";
import { AppleSubscriptions, confirmAppleTransaction, subscriptionRequest, type AppleTransaction } from "@/lib/apple-subscriptions";

type Subscription = { planCode: string; planName: string; status: string; isActive: boolean; trialEndsAt?: string; currentPeriodEnd?: string; billingProvider?: string; limits?: Record<string, number>; usage?: Record<string, number>; featureDetails?: Array<{ key: string; name: string }> };
type Catalog = { configured: boolean; canManage: boolean; canPurchase: boolean; trialActive: boolean; appAccountToken: string; products: Array<{ id: string; planCode: string }> };
type Plan = { code: string; name: string; description: string; monthlyPrice: number; currency: string };
const date = (value?: string) => value ? new Date(value).toLocaleDateString("fr-HT") : "Sans expiration";

export function IosSubscriptions() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceMessage, setPriceMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const working = useRef(false);
  const refresh = useCallback(async () => {
    const [current, available, offers] = await Promise.all([
      subscriptionRequest<Subscription>("me"), subscriptionRequest<Catalog>("apple/catalog"), subscriptionRequest<Plan[]>("plans")
    ]);
    setSubscription(current); setCatalog(available); setPlans(offers.filter(plan => plan.code.startsWith("POS_")));
    // Reading StoreKit prices does not require enabling server-side purchases.
    // Keep the plan catalogue visible if Apple's storefront is unavailable.
    try {
      const products = await AppleSubscriptions.products();
      setPrices(Object.fromEntries(products.products.map(product => [product.id, product.price])));
      setPriceMessage(available.products.some(offer => !products.products.some(product => product.id === offer.id)) ? "Certaines offres Apple ne sont pas disponibles pour le moment. Les tarifs de référence restent affichés; aucun achat ne peut démarrer sans offre Apple." : "");
    } catch { setPrices({}); setPriceMessage("Les prix Apple n’ont pas pu être chargés. Vérifiez votre connexion puis réessayez. Les tarifs de référence restent affichés."); }
    return available;
  }, []);
  const confirm = useCallback(async (transactions: AppleTransaction[], token: string) => {
    const matching = transactions.filter(item => item.appAccountToken.toLowerCase() === token.toLowerCase());
    for (const transaction of matching) await confirmAppleTransaction(transaction, token);
    if (matching.length) { await refresh(); window.dispatchEvent(new Event("vta-subscription-updated")); }
    return matching.length;
  }, [refresh]);
  useEffect(() => {
    let active = true;
    void refresh().then(async available => {
      if (active && available.configured) await confirm((await AppleSubscriptions.pending()).transactions, available.appAccountToken);
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Abonnement indisponible."); }).finally(() => { if (active) setLoading(false); });
    const listener = AppleSubscriptions.addListener("transactionUpdated", () => {
      // Purchase() already verifies its own response. Pending transactions remain recoverable.
      if (working.current) return;
      working.current = true;
      void refresh().then(async available => {
        if (available.configured) await confirm((await AppleSubscriptions.pending()).transactions, available.appAccountToken);
      }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Vérification en attente."); }).finally(() => { working.current = false; });
    });
    return () => { active = false; void listener.then(handle => handle.remove()).catch(() => {}); };
  }, [refresh, confirm]);

  async function action(task: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(""); setMessage("");
    try { await task(); } catch (err) { setError(err instanceof Error ? err.message : "Opération Apple impossible."); }
    finally { working.current = false; setBusy(false); }
  }
  async function buy(id: string) {
    if (!catalog?.canPurchase) return;
    await action(async () => {
      const result = await AppleSubscriptions.purchase({ productId: id, appAccountToken: catalog.appAccountToken });
      if (result.status === "pending") setMessage("Achat en attente d’autorisation Apple. Votre plan reste inchangé pour le moment.");
      else if (result.status === "purchased" && result.transaction) {
        await confirmAppleTransaction(result.transaction, catalog.appAccountToken);
        await refresh(); window.dispatchEvent(new Event("vta-subscription-updated"));
        setMessage("Achat vérifié. Le plan est actif pour votre entreprise sur tous vos appareils.");
      }
    });
  }
  return <div className="space-y-4">
    <IosPageHeading title="Abonnement" />
    {loading && <p role="status" className="rounded-2xl bg-white p-5">Chargement de votre abonnement…</p>}
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="mt-3 block font-semibold" disabled={busy} onClick={() => void action(async () => { await refresh(); })}>Réessayer</button></div>}
    {message && <p role="status" className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">{message}</p>}
    {subscription && <>
      <section className="rounded-2xl bg-brand-600 p-5 text-white">
        <p className="text-sm opacity-90">Votre entreprise · Plan actuel</p>
        <h2 className="mt-1 text-2xl font-bold">{subscription.planName}</h2>
        <p className="mt-2 text-sm">{subscription.planCode === "TRIAL" ? `Essai gratuit jusqu’au ${date(subscription.trialEndsAt)}` : subscription.planCode === "POS_FREE" ? "Gratuit, sans expiration" : `Période en cours jusqu’au ${date(subscription.currentPeriodEnd)}`}</p>
      </section>
      {catalog?.trialActive && <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><h2 className="font-bold">Votre premier mois est offert</h2><p className="mt-2">Toutes les fonctionnalités sont disponibles pendant l’essai. À la fin, votre entreprise passe au plan Gratuit. Aucun prélèvement sans achat confirmé auprès d’Apple.</p></section>}
      {!catalog?.configured && <p className="rounded-2xl border bg-white p-4 text-sm text-slate-600">{catalog?.canManage === false ? "Seul le propriétaire peut modifier l’abonnement. Votre accès actuel reste utilisable selon votre plan." : "Les achats Apple ne sont pas encore disponibles. Votre accès actuel reste utilisable selon votre plan."}</p>}
      {priceMessage && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p>{priceMessage}</p><button className="mt-3 min-h-11 font-semibold disabled:opacity-40" disabled={busy} onClick={() => void action(async () => { await refresh(); })}>Recharger les offres Apple</button></div>}
      <section className="space-y-3" aria-label="Plans VTA POS">
        {plans.map(plan => {
          const product = catalog?.products.find(item => item.planCode === plan.code);
          const price = product ? prices[product.id] : null;
          const current = plan.code === subscription.planCode;
          const offer = appleOfferState({ busy, current, canManage: catalog?.canManage === true, trialActive: catalog?.trialActive === true, appleManaged: subscription.billingProvider === "APPLE", configured: catalog?.configured === true, canPurchase: catalog?.canPurchase === true, priceAvailable: Boolean(price) });
          return <article key={plan.code} className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{plan.name}</h2>{current && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Actuel</span>}</div>
            <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
            <p className="mt-3 text-lg font-bold">{plan.code === "POS_FREE" ? "Gratuit" : price ?? new Intl.NumberFormat("fr-HT", { style: "currency", currency: plan.currency || "USD" }).format(Number(plan.monthlyPrice))}</p>
            <p className="text-xs text-slate-500">{plan.code === "POS_FREE" ? "Sans expiration" : "par mois · pour cette entreprise"}</p>
            {plan.code !== "POS_FREE" && !price && <p className="mt-2 text-xs text-slate-500">Tarif de référence. Le prix dans votre devise sera confirmé par Apple avant tout achat.</p>}
            {product && <button className="mt-4 min-h-11 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40" disabled={offer.disabled} onClick={() => void buy(product.id)}>{offer.label}</button>}
          </article>;
        })}
      </section>
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="font-bold">Gérer vos achats Apple</h2>
        <p className="mt-2 text-sm text-slate-600">Un achat est associé à cette entreprise. Les abonnements se renouvellent automatiquement, sauf annulation au moins 24 heures avant la fin de la période. Vous pouvez modifier ou annuler votre abonnement dans Apple.</p>
        <button className="mt-4 min-h-11 w-full rounded-xl border p-3 text-sm font-semibold disabled:opacity-40" disabled={busy || !catalog?.configured} onClick={() => void action(async () => { const count = await confirm((await AppleSubscriptions.restore()).transactions, catalog!.appAccountToken); setMessage(count ? "Achats restaurés pour cette entreprise." : "Aucun achat associé à cette entreprise. Vérifiez votre compte Apple et votre compte VTA POS."); })}>Restaurer les achats</button>
        <button className="mt-2 min-h-11 w-full rounded-xl border p-3 text-sm font-semibold" disabled={busy} onClick={() => void action(() => AppleSubscriptions.manage())}>Gérer ou annuler dans Apple</button>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-brand-600"><Link href="/terms">Conditions d’utilisation</Link><Link href="/privacy">Confidentialité</Link></div>
      </section>
      {subscription.limits && <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">Utilisation du plan</h2><dl className="mt-3 space-y-2 text-sm">{Object.entries({ users: "Utilisateurs", stores: "Boutiques", warehouses: "Dépôts", cashRegisters: "Caisses" }).map(([key, label]) => <div key={key} className="flex justify-between"><dt>{label}</dt><dd>{subscription.usage?.[key] ?? 0} / {subscription.limits?.[key] ?? 0}</dd></div>)}</dl></section>}
    </>}
  </div>;
}

"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Crown, LockKeyhole } from "lucide-react";
import { subscriptionRequest, SubscriptionRequestError } from "@/lib/apple-subscriptions";
import { hasValidOfflineSession } from "@/lib/auth";
import { networkTimeout } from "@/lib/network-timeout";
import { firstPlanForFeature, includesPlanFeature, requiredPlanFeature, type BusinessEntitlements, type BusinessPlan } from "@/lib/subscription-access";

type Access = { subscription: BusinessEntitlements | null; plans: BusinessPlan[]; loading: boolean; error: string; reload: () => void };
const PlanContext = createContext<Access>({ subscription: null, plans: [], loading: true, error: "", reload: () => {} });
export const useIosPlan = () => useContext(PlanContext);
export function IosPlanProvider({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const [state, setState] = useState<Omit<Access, "reload">>({ subscription: null, plans: [], loading: true, error: "" });
  const reload = useCallback(() => { window.dispatchEvent(new Event("vta-subscription-updated")); }, []);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const key = `vta_plan_access_${tenantId}`;
    async function load() {
      const request = ++sequence;
      try {
        const subscription = await subscriptionRequest<BusinessEntitlements>("me", undefined, networkTimeout(8000));
        if (subscription.tenantId !== tenantId) throw new Error("Abonnement d’une autre entreprise.");
        const plans = await subscriptionRequest<BusinessPlan[]>("plans", undefined, networkTimeout(8000)).catch(() => []);
        if (!active || request !== sequence) return;
        setState({ subscription, plans, loading: false, error: "" });
        try { localStorage.setItem(key, JSON.stringify({ subscription, plans, checkedAt: Date.now() })); } catch {}
      } catch (error) {
        if (!active || request !== sequence) return;
        let cached: { subscription: BusinessEntitlements; plans: BusinessPlan[]; checkedAt: number } | null = null;
        try { cached = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
        if (!(error instanceof SubscriptionRequestError && [401, 403].includes(error.status)) && cached?.subscription.tenantId === tenantId && hasValidOfflineSession() && Date.now() - cached.checkedAt < 7 * 86400000 && cached.checkedAt <= Date.now()) {
          setState({ subscription: cached.subscription, plans: cached.plans, loading: false, error: "Mode hors ligne · derniers droits vérifiés" });
        } else setState({ subscription: null, plans: [], loading: false, error: "Impossible de vérifier votre plan. Connectez-vous à Internet puis réessayez." });
      }
    }
    void load();
    const timer = window.setInterval(() => { if (navigator.onLine) void load(); }, 60000);
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("vta-subscription-updated", load);
    window.addEventListener("online", load);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; clearInterval(timer); window.removeEventListener("vta-subscription-updated", load); window.removeEventListener("online", load); document.removeEventListener("visibilitychange", visible); };
  }, [tenantId]);
  return <PlanContext.Provider value={{ ...state, reload }}>{children}</PlanContext.Provider>;
}
export function IosSubscriptionCard({ compact = false }: { compact?: boolean }) {
  const { subscription, loading, error } = useIosPlan();
  return <Link className={compact ? "ios-plan-link" : "ios-plan-card"} href="/dashboard/settings/subscription" aria-label="Mon abonnement, voir les plans"><Crown size={compact ? 17 : 23}/><span><small>Mon abonnement</small><strong>{loading ? "Chargement…" : subscription?.planName || "Voir les plans"}</strong>{!compact && <em>{subscription?.planCode === "TRIAL" ? "Premier mois offert · aucun prélèvement automatique" : "Voir les fonctionnalités et les limites de votre plan"}</em>}{!compact && error && <em>{error}</em>}</span><ChevronRight size={18}/></Link>;
}
export function IosFeatureLock({ feature }: { feature: string }) {
  const { plans, subscription } = useIosPlan();
  const plan = firstPlanForFeature(plans, feature);
  return <section className="ios-plan-lock"><LockKeyhole size={30}/><h1>Une fonctionnalité pour votre prochain plan</h1><p>Votre plan actuel : <strong>{subscription?.planName || "Indisponible"}</strong>.</p><p>{plan ? `Disponible dès ${plan.name}.` : "Consultez les plans pour connaître les fonctionnalités incluses."}</p><Link href="/dashboard/settings/subscription">Comparer les plans<ChevronRight size={18}/></Link><p>Vos données sont conservées. Changer de plan ne modifie pas les permissions de votre rôle.</p></section>;
}
export function IosPlanBadge({ href }: { href: string }) {
  const { subscription, plans, loading } = useIosPlan();
  const feature = requiredPlanFeature(href);
  if (loading || !feature || includesPlanFeature(subscription, feature)) return null;
  return <small className="ios-plan-badge"><LockKeyhole size={12}/>{firstPlanForFeature(plans, feature)?.name.replace("VTA POS ", "") || "Autre plan"}</small>;
}
export function IosPlanRouteGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { subscription, loading, error, reload } = useIosPlan();
  const feature = requiredPlanFeature(path);
  if (!feature) return <>{children}</>;
  if (loading) return <p className="vm-state" role="status">Vérification de votre plan…</p>;
  if (!subscription) return <section className="ios-plan-lock"><p role="alert">{error}</p><button onClick={reload}>Réessayer</button><Link href="/dashboard/settings/subscription">Mon abonnement</Link></section>;
  if (!includesPlanFeature(subscription, feature)) return <IosFeatureLock feature={feature}/>;
  return <>{children}</>;
}

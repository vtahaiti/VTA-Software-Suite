export type AdminSubscriptionSource = {
  plan?: string | null;
  planCode?: string | null;
  subscriptionStatus?: string | null;
  status?: string | null;
  subscriptionEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  endsAt?: string | null;
  paymentPending?: boolean | null;
  paymentReceived?: boolean | null;
  trial?: boolean | null;
};

const planLabels: Record<string, string> = {
  TRIAL: "Essai gratuit",
  FREE: "Essai gratuit",
  ESSENTIAL: "Essentiel",
  STARTER: "Essentiel",
  BASIC: "Essentiel",
  STANDARD: "Professionnel",
  PRO: "Professionnel",
  PROFESSIONAL: "Professionnel",
  PROFESSIONNEL: "Professionnel",
  EXPERT: "Expert",
  ENTERPRISE: "Expert"
};

const statusLabels: Record<string, string> = {
  TRIAL: "Essai en cours",
  TRIALING: "Essai en cours",
  ACTIVE: "Actif",
  PAST_DUE: "Paiement en retard",
  GRACE_PERIOD: "Période de grâce",
  PAUSED: "En pause",
  SUSPENDED: "Suspendu",
  CANCELED: "Annulé",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré"
};

const paidPlans = new Set(["ESSENTIAL", "STARTER", "BASIC", "STANDARD", "PRO", "PROFESSIONAL", "PROFESSIONNEL", "EXPERT", "ENTERPRISE"]);

export function labelAdminPlan(code?: string | null) {
  const normalized = normalize(code);
  return planLabels[normalized] ?? code ?? "-";
}

export function labelAdminSubscriptionStatus(status?: string | null) {
  const normalized = normalize(status);
  return statusLabels[normalized] ?? status ?? "-";
}

export function formatAdminDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("fr-HT") : "Non définie";
}

export function getAdminSubscriptionDisplay(source: AdminSubscriptionSource) {
  const planCode = normalize(source.planCode ?? source.plan);
  const subscriptionStatus = normalize(source.subscriptionStatus ?? source.status);
  const tenantStatus = normalize(source.status);
  const isPaidPlan = paidPlans.has(planCode);
  const isActivePaid = isPaidPlan && subscriptionStatus === "ACTIVE";
  const isTrial = !isActivePaid && (source.trial === true || subscriptionStatus === "TRIALING" || tenantStatus === "TRIAL" || planCode === "TRIAL" || planCode === "FREE");
  const effectiveStatus = isActivePaid ? "ACTIVE" : isTrial ? "TRIALING" : subscriptionStatus || tenantStatus;
  const dueDate = source.currentPeriodEnd ?? source.subscriptionEndsAt ?? source.trialEndsAt ?? source.endsAt ?? null;
  const paymentLabel = source.paymentPending
    ? "Paiement en attente"
    : source.paymentReceived || isActivePaid
      ? "Paiement reçu"
      : isTrial
        ? "Aucune demande"
        : "À vérifier";

  return {
    planLabel: labelAdminPlan(planCode),
    statusLabel: labelAdminSubscriptionStatus(effectiveStatus),
    paymentLabel,
    dueDateLabel: formatAdminDate(dueDate),
    tenantStatusLabel: tenantStatus ? labelAdminSubscriptionStatus(tenantStatus) : "-"
  };
}

function normalize(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

type OfferAccess = {
  busy: boolean; current: boolean; canManage: boolean; trialActive: boolean;
  appleManaged: boolean; configured: boolean; canPurchase: boolean; priceAvailable: boolean;
};

export function appleOfferState(access: OfferAccess) {
  const label = access.busy ? "Patientez…"
    : access.current ? "Plan actuel"
    : !access.canManage ? "Réservé au propriétaire"
    : access.trialActive ? "Disponible après votre essai"
    : access.appleManaged ? "Modifier avec Apple ci-dessous"
    : !access.configured ? "Achats Apple indisponibles"
    : !access.priceAvailable ? "Offre Apple indisponible"
    : !access.canPurchase ? "Achat temporairement indisponible"
    : "S’abonner avec Apple";
  return { label, disabled: access.busy || access.current || !access.canManage || access.trialActive || access.appleManaged || !access.configured || !access.canPurchase || !access.priceAvailable };
}

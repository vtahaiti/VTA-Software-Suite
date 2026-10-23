import type { BusinessSector } from "./business-profiles";
const pendingKey = "vta_pending_onboarding";
const detailsKey = "vta_pending_onboarding_details";
const draftKey = "vta_onboarding_company_draft";
const draftFields = new Set(["companyName","businessSector","businessSpecialty","businessProfileSlug","country","department","city","otherCity","address","phone","whatsapp","email","website","taxNumber","currency","language","timezone","primaryColor","secondaryColor","logoUrl"]);
export function rememberPendingRegistration(pendingToken: string, email: string, phone = "") {
  if (!pendingToken || ["undefined", "null"].includes(pendingToken)) throw new Error("La session d’inscription n’a pas été reçue. Réessayez.");
  localStorage.setItem(pendingKey, pendingToken);
  localStorage.setItem(detailsKey, JSON.stringify({ pendingToken, email, phone, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }));
}
export function pendingRegistration() {
  const pendingToken = localStorage.getItem(pendingKey) ?? "";
  if (!pendingToken || ["undefined", "null"].includes(pendingToken)) return null;
  let details: { pendingToken?: string; email?: string; phone?: string; expiresAt?: number } = {};
  try { details = JSON.parse(localStorage.getItem(detailsKey) ?? "{}"); } catch { /* Older clients stored only the token. */ }
  if (details.pendingToken !== pendingToken) details = {};
  if (details.expiresAt && details.expiresAt <= Date.now()) return null;
  return { pendingToken, email: typeof details.email === "string" ? details.email : "", phone: typeof details.phone === "string" ? details.phone : "" };
}
export function readCompanyDraft(pendingToken: string): Record<string, string | string[]> {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null");
    if (draft?.pendingToken !== pendingToken || !draft.form) return {};
    return filterDraft(draft.form);
  } catch { return {}; }
}
export function rememberCompanyDraft(pendingToken: string, form: object) {
  try { localStorage.setItem(draftKey, JSON.stringify({ pendingToken, form: filterDraft(form) })); } catch { /* A full storage must not block completing registration. */ }
}
function filterDraft(form: object): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key,value] of Object.entries(form)) {
    if (draftFields.has(key) && typeof value === "string" && !value.startsWith("data:")) result[key] = value;
    if (key === "secondaryActivities" && Array.isArray(value)) result[key] = value.filter(item => typeof item === "string");
  }
  return result;
}
export function clearOnboardingProgress() {
  for (const key of [pendingKey, detailsKey, draftKey]) localStorage.removeItem(key);
}
export function reconcileBusinessSelection(sectors: BusinessSector[], current: { businessSector: string; businessSpecialty: string }) {
  const sector = sectors.find(item => item.key === current.businessSector) ?? sectors[0];
  if (!sector?.specialties.length) throw new Error("Catalogue d’activités indisponible.");
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const specialty = sector.specialties.find(item => normalize(item.name) === normalize(current.businessSpecialty)) ?? sector.specialties[0];
  return { businessSector: sector.key, businessSpecialty: specialty.name, businessProfileSlug: specialty.profileType };
}

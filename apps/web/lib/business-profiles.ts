import { getAccessToken } from "@/lib/auth";

export type BusinessMenuSection = { title: string; items: Array<{ label: string; href: string }> };
export type BusinessActivity = { name: string; profileType: string };
export type BusinessCategory = { key: string; name: string; description: string; activities: BusinessActivity[] };
export type BusinessActivityTemplate = { label: string; categoryKey: string; profileType: string; categories: string[] };
export type BusinessProfile = { slug: string; name: string; description?: string; icon?: string; isPrimary?: boolean; isActive?: boolean; modules?: string[]; category?: string };
export type BusinessModule = { key: string; name: string; description?: string; category: string; route?: string; permissions?: string[]; menuItems?: Array<{ label: string; href: string; section: string }>; widgets?: Array<{ key: string; label: string; description: string }> };
export type TenantBusinessConfiguration = {
  profiles: BusinessProfile[];
  modules: BusinessModule[];
  simpleMenuSections?: BusinessMenuSection[];
  expertMenuSections?: BusinessMenuSection[];
  menuSections: BusinessMenuSection[];
  widgets: Array<{ key: string; label: string; description: string; module: string }>;
  categories?: BusinessCategory[];
  businessCategory?: string;
  primaryActivity?: string;
  secondaryActivities?: string[];
  businessProfileType?: string;
  enabledBusinessModules?: string[];
  offline?: { prepared: boolean; message: string };
};

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

export const simpleMenuSections: BusinessMenuSection[] = [
  { title: "Menu", items: [
    { label: "Accueil", href: "/dashboard" },
    { label: "Nouvelle vente", href: "/dashboard/pos" },
    { label: "Produits", href: "/dashboard/products" },
    { label: "Stock", href: "/dashboard/inventory" },
    { label: "Clients", href: "/dashboard/customers" },
    { label: "Fournisseurs", href: "/dashboard/suppliers" },
    { label: "Achats", href: "/dashboard/purchases" },
    { label: "Rapports", href: "/dashboard/reports" },
    { label: "Paramètres", href: "/dashboard/settings/company" }
  ] }
];

export const fallbackMenuSections = simpleMenuSections;

export async function getBusinessCatalog() {
  const response = await fetch(`${apiUrl}/business-profiles/catalog`, { cache: "no-store" });
  if (!response.ok) return { categories: [], activityTemplates: [], profiles: [], modules: [] } as { categories: BusinessCategory[]; activityTemplates: BusinessActivityTemplate[]; profiles: BusinessProfile[]; modules: BusinessModule[] };
  return response.json() as Promise<{ categories: BusinessCategory[]; activityTemplates: BusinessActivityTemplate[]; profiles: BusinessProfile[]; modules: BusinessModule[] }>;
}

export async function getTenantBusinessConfiguration() {
  const token = getAccessToken();
  if (!token) return null;
  const response = await fetch(`${apiUrl}/business-profiles/tenant`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<TenantBusinessConfiguration>;
}

export async function updateBusinessSelection(payload: { businessCategory: string; primaryActivity: string; secondaryActivities?: string[] }) {
  const token = getAccessToken();
  const response = await fetch(`${apiUrl}/business-profiles/tenant/selection`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error("Modification de l'activité impossible.");
  return response.json() as Promise<TenantBusinessConfiguration>;
}

export async function activateBusinessProfile(slug: string, isPrimary = false) {
  const token = getAccessToken();
  const response = await fetch(`${apiUrl}/business-profiles/tenant/profiles`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ slug, isPrimary }) });
  if (!response.ok) throw new Error("Activation du profil impossible.");
  return response.json() as Promise<TenantBusinessConfiguration>;
}

export async function deactivateBusinessProfile(slug: string) {
  const token = getAccessToken();
  const response = await fetch(`${apiUrl}/business-profiles/tenant/profiles/${slug}/disable`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Désactivation du profil impossible.");
  return response.json() as Promise<TenantBusinessConfiguration>;
}

export async function setBusinessModuleState(key: string, isActive: boolean) {
  const token = getAccessToken();
  const response = await fetch(`${apiUrl}/business-profiles/tenant/modules/${key}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ isActive }) });
  if (!response.ok) throw new Error("Modification du module impossible.");
  return response.json() as Promise<TenantBusinessConfiguration>;
}

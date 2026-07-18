const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

export type CompanyBranding = {
  companyName: string;
  companyInitials: string;
  logoUrl: string | null;
  primaryColor: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  country: string;
  taxNumber: string;
  userName: string;
  userInitials: string;
  userPhotoUrl: string | null;
  role: string;
  userEmail: string;
};

export async function getCompanyBranding(token: string): Promise<CompanyBranding | null> {
  const response = await fetch(`${apiUrl}/profile/me?branding=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const data = await response.json();
  const profile = data.tenant?.companyProfile;
  const companyName = profile?.companyName ?? profile?.name ?? data.tenant?.name ?? "Mon entreprise";
  return {
    companyName,
    companyInitials: initials(companyName, "ME"),
    logoUrl: resolveAssetUrl(profile?.logoUrl),
    primaryColor: profile?.primaryColor ?? "#2563eb",
    phone: profile?.phone ?? "",
    whatsapp: profile?.whatsapp ?? "",
    email: profile?.email ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? "",
    taxNumber: profile?.taxNumber ?? "",
    userName: data.name ?? "Utilisateur",
    userInitials: initials(data.name, "U"),
    userPhotoUrl: resolveAssetUrl(data.profile?.photoUrl),
    role: data.role ?? "Session",
    userEmail: data.email ?? ""
  };
}

export function initials(name?: string, fallback = "ME") {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || fallback;
}

export function resolveAssetUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value;
  return `${apiUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

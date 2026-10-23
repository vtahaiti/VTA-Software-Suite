import type { CompanyBranding } from "@/lib/company-branding";
import { getCurrentUser } from "@/lib/auth";
import { apiBaseUrl } from "@/lib/api-url";
import { networkTimeout } from "@/lib/network-timeout";
import { getOfflineReceiptBranding, saveOfflineReceiptBranding, type OfflineReceiptBranding } from "@/lib/offline-db";

import { isEmbeddedLogo } from "@/lib/receipt-logo";

export async function embedReceiptLogo(url: string, token?: string | null): Promise<string> {
  if (isEmbeddedLogo(url)) return url;
  const source = new URL(url, apiBaseUrl);
  if (!['https:', 'http:'].includes(source.protocol)) throw new Error("Format du logo non pris en charge.");
  const headers: Record<string, string> = {};
  if (token && source.origin === new URL(apiBaseUrl).origin) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(source.toString(), { headers, signal: networkTimeout(5000) });
  if (!response.ok) throw new Error("Téléchargement du logo impossible.");
  const blob = await response.blob();
  if (!/^image\/(png|jpeg|webp)$/i.test(blob.type) || blob.size > 2 * 1024 * 1024) throw new Error("Le logo doit être une image PNG, JPEG ou WebP de moins de 2 Mo.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
export async function prepareReceiptBranding(branding: CompanyBranding, token: string): Promise<OfflineReceiptBranding> {
  const owner = getCurrentUser();
  const cached = await getOfflineReceiptBranding();
  let logoDataUrl: string | null = null;
  if (branding.logoUrl) {
    try { logoDataUrl = await embedReceiptLogo(branding.logoUrl, token); }
    catch { if (cached?.logoSource === branding.logoUrl) logoDataUrl = cached.logoDataUrl; }
  }
  const result: OfflineReceiptBranding = { companyName: branding.companyName, logoSource: branding.logoUrl, logoDataUrl, logoUnavailable: Boolean(branding.logoUrl && !logoDataUrl) };
  const current = getCurrentUser();
  if (current?.id !== owner?.id || current?.tenantId !== owner?.tenantId) throw new Error("Session modifiée pendant la préparation du logo.");
  await saveOfflineReceiptBranding(result);
  return result;
}

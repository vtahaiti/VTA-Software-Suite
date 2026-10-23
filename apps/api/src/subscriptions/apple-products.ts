import { createHash } from "crypto";

export const appleProducts: Record<string, string> = {
  "com.vtaerp.pos.basic.monthly": "POS_BASIC",
  "com.vtaerp.pos.premium.monthly": "POS_PREMIUM",
  "com.vtaerp.pos.pro.monthly": "POS_PRO"
};

// Stable UUID per business: a purchase can never be restored into another business.
export function appleAccountToken(tenantId: string) {
  const hex = createHash("sha256").update(`vta-pos:apple:${tenantId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

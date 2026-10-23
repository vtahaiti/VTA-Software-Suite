// Exact immutable IDs only: never grant internal access from a company name,
// email address or slug that a customer could reproduce.
export const VTA_ENTERPRISE_TENANT_ID = "cmrmd6u2200w9a2m8mdgz41l4";
const LEGACY_VTA_ENTERPRISE_TENANT_ID = "tenant_vta";

export function isVtaEnterpriseTenant(tenantId: string) {
  return tenantId === VTA_ENTERPRISE_TENANT_ID || tenantId === LEGACY_VTA_ENTERPRISE_TENANT_ID;
}

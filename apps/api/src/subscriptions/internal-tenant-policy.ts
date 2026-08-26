export const VTA_ENTERPRISE_TENANT_ID = "tenant_vta";

export function isVtaEnterpriseTenant(tenantId: string) {
  return tenantId === VTA_ENTERPRISE_TENANT_ID;
}

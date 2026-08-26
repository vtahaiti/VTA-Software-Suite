const tenantBlockingCodes = new Set([
  "TENANT_PAUSED",
  "TENANT_SUSPENDED",
  "TENANT_EXPIRED",
  "TENANT_DELETED",
  "SUBSCRIPTION_INACTIVE"
]);

export async function isTenantAccessBlockedResponse(response: Response) {
  if (response.status !== 403) return false;
  const body = await response.clone().json().catch(() => null) as { code?: unknown; message?: { code?: unknown } } | null;
  const code = typeof body?.code === "string"
    ? body.code
    : typeof body?.message === "object" && typeof body.message?.code === "string"
      ? body.message.code
      : "";
  return tenantBlockingCodes.has(code);
}

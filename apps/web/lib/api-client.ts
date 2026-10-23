import { getAccessToken, refreshSession } from "@/lib/auth";
import { apiUrl } from "@/lib/api-url";
import { isTenantAccessBlockedResponse } from "@/lib/tenant-access";

export { apiUrl };

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetchWithCurrentToken(resolveInput(input), init).then(async (response) => {
    if (typeof window !== "undefined" && await isTenantAccessBlockedResponse(response)) {
      window.dispatchEvent(new CustomEvent("vta:tenant-access-blocked"));
      return response;
    }
    if (response.status !== 401) return response;
    const refreshedUser = await refreshSession();
    if (!refreshedUser) return response;
    return fetchWithCurrentToken(resolveInput(input), init);
  });
}

function resolveInput(input: RequestInfo | URL) {
  if (typeof input === "string" && input.startsWith("/")) return apiUrl(input);
  return input;
}

async function fetchWithCurrentToken(input: RequestInfo | URL, init: RequestInit) {
  let token = getAccessToken();
  if (!token) {
    const refreshedUser = await refreshSession();
    token = refreshedUser ? getAccessToken() : null;
  }
  const headers = new Headers(init.headers);
  // Capacitor 6's native fetch bridge expects a multipart content type before
  // it converts FormData; it then removes it and generates its own boundary.
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" && typeof FormData !== "undefined" && init.body instanceof FormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "multipart/form-data");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

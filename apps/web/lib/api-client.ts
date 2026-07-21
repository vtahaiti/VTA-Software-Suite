import { getAccessToken, refreshSession } from "@/lib/auth";
import { apiUrl } from "@/lib/api-url";

export { apiUrl };

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetchWithCurrentToken(resolveInput(input), init).then(async (response) => {
    if (response.status === 403 && typeof window !== "undefined") {
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
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

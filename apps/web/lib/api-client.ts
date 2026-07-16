import { getAccessToken, refreshSession } from "@/lib/auth";

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetchWithCurrentToken(input, init).then(async (response) => {
    if (response.status !== 401 && response.status !== 403) return response;
    const refreshedUser = await refreshSession();
    if (!refreshedUser) return response;
    return fetchWithCurrentToken(input, init);
  });
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

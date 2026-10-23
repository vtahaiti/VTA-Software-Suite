import { apiUnavailableMessage, fetchApi, publicApiErrorMessage } from "@/lib/api-url";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  tenant: string;
  tenantId: string;
  createdAt: string;
  photoUrl?: string | null;
  onboardingCompleted?: boolean;
};

type LoginPayload = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

const accessTokenKey = "vta_access_token";
const refreshTokenKey = "vta_refresh_token";
const userKey = "vta_user";
const offlineValidatedKey = "vta_offline_validated_at";
const offlineAccessDurationMs = 7 * 24 * 60 * 60 * 1000;

export function hasValidOfflineSession() {
  if (typeof window === "undefined") return false;
  const validatedAt = Number(window.localStorage.getItem(offlineValidatedKey));
  const age = Date.now() - validatedAt;
  return validatedAt > 0 && age >= 0 && age <= offlineAccessDurationMs;
}

const tenantScopedLocalStoragePrefixes = ["vta_pos_draft_"];
const tenantScopedLocalStorageKeys = ["vta_pending_pos_print"];
const offlineDbName = "vta-commerce-offline";

export async function login(payload: LoginPayload) {
  let response: Response;

  try {
    response = await fetchApi("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error(apiUnavailableMessage);
  }

  if (!response.ok) {
    const error = await readApiError(response);
    throw new Error(error);
  }

  const data = (await response.json()) as AuthResponse;
  saveSession(data);
  return data.user;
}

export async function logout() {
  const token = getAccessToken();

  if (token) {
    await fetchApi("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include"
    }).catch(() => undefined);
  }

  clearSession();
}

export async function refreshSession() {
  const refreshToken = window.localStorage.getItem(refreshTokenKey);

  if (!refreshToken) {
    clearSession();
    return null;
  }

  let response: Response;
  try {
    response = await fetchApi("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ refreshToken })
  });
  } catch {
    // Keep queued offline sales and the stored session during transport failures.
    return null;
  }

  if (!response.ok) {
    clearSession();
    return null;
  }

  const data = (await response.json()) as AuthResponse;
  saveSession(data);
  return data.user;
}

export function getCurrentUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(userKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(accessTokenKey);
}

export function saveSession(data: AuthResponse) {
  const previousUser = getCurrentUser();
  if (previousUser?.tenantId && previousUser.tenantId !== data.user.tenantId) {
    clearTenantScopedCaches("tenant-switch");
  }
  window.localStorage.setItem(accessTokenKey, data.accessToken);
  window.localStorage.setItem(refreshTokenKey, data.refreshToken);
  window.localStorage.setItem(userKey, JSON.stringify(data.user));
  window.localStorage.setItem(offlineValidatedKey, String(Date.now()));
  window.dispatchEvent(new CustomEvent("vta:session-changed", { detail: { tenantId: data.user.tenantId } }));
}

export function updateStoredUser(user: AuthUser) {
  const previousUser = getCurrentUser();
  if (previousUser?.tenantId && previousUser.tenantId !== user.tenantId) {
    clearTenantScopedCaches("tenant-switch");
  }
  window.localStorage.setItem(userKey, JSON.stringify(user));
  window.localStorage.setItem(offlineValidatedKey, String(Date.now()));
  window.dispatchEvent(new CustomEvent("vta:session-changed", { detail: { tenantId: user.tenantId } }));
}

export function clearSession() {
  clearTenantScopedCaches("logout");
  window.localStorage.removeItem(accessTokenKey);
  window.localStorage.removeItem(refreshTokenKey);
  window.localStorage.removeItem(userKey);
  window.localStorage.removeItem(offlineValidatedKey);
  window.dispatchEvent(new CustomEvent("vta:session-cleared"));
}

export function clearTenantScopedCaches(reason = "session-reset") {
  if (typeof window === "undefined") return;
  for (const key of Object.keys(window.localStorage)) {
    if (tenantScopedLocalStoragePrefixes.some((prefix) => key.startsWith(prefix)) || tenantScopedLocalStorageKeys.includes(key)) {
      window.localStorage.removeItem(key);
    }
  }
  if ("indexedDB" in window && reason === "legacy-cache-reset") {
    const request = window.indexedDB.deleteDatabase(offlineDbName);
    request.onerror = () => undefined;
    request.onsuccess = () => undefined;
    request.onblocked = () => undefined;
  }
  window.dispatchEvent(new CustomEvent("vta:tenant-cache-cleared", { detail: { reason } }));
}

async function readApiError(response: Response) {
  try {
    const body = await response.json();
    const message = Array.isArray(body.message) ? body.message[0] : body.message ?? "Connexion impossible";
    return publicApiErrorMessage(message, "Connexion impossible.");
  } catch {
    return "Connexion impossible";
  }
}
export async function registerUser(payload: { firstName: string; lastName: string; email: string; phone?: string; password: string; confirmPassword: string; acceptedTerms: boolean }) {
  const response = await fetchApi("/onboarding/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, firstName: payload.firstName.trim(), lastName: payload.lastName.trim(), email: payload.email.trim().toLowerCase(), phone: payload.phone?.trim() })
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json() as { pendingToken: string; email: string; message: string; expiresAt?: string };
  if (!data.pendingToken || typeof data.pendingToken !== "string") throw new Error("Session d’inscription non reçue. Réessayez.");
  return data;
}

export async function requestPasswordReset(payload: { email: string }) {
  const response = await fetchApi("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<{ message: string }>;
}

export async function resetPassword(payload: { token: string; newPassword: string; confirmPassword: string }) {
  const response = await fetchApi("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<{ message: string }>;
}

export async function createCompany(payload: Record<string, unknown>) {
  const response = await fetchApi("/onboarding/company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = (await response.json()) as AuthResponse;
  if (!data.accessToken || !data.refreshToken || !data.user?.id || !data.user?.tenantId) throw new Error("L’entreprise n’a pas pu être confirmée. Essayez de vous connecter avant de recommencer.");
  saveSession(data);
  return data.user;
}

export async function getOnboardingStatus() {
  const token = getAccessToken();
  if (!token) return { completed: false };
  let response: Response;
  try {
    response = await fetchApi("/onboarding/status", { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { completed: false };
  }
  if (!response.ok) return { completed: false };
  return response.json() as Promise<{ completed: boolean }>;
}

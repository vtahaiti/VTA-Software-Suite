"use client";

import type { AuthUser } from "@/lib/auth";
import { fetchApi, publicApiErrorMessage } from "@/lib/api-url";

const accessTokenKey = "vta_platform_access_token";
const refreshTokenKey = "vta_platform_refresh_token";
const userKey = "vta_platform_user";

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export function isPlatformAdmin() {
  const user = getPlatformUser();
  const token = getPlatformAccessToken();
  return Boolean(token && isSuperAdmin(user));
}

export async function platformLogin(payload: { email: string; password: string; rememberMe: boolean }) {
  const response = await fetchApi("/auth/platform/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as AuthResponse;
  savePlatformSession(data);
  return data.user;
}

export async function platformLogout() {
  const token = getPlatformAccessToken();
  if (token) {
    await fetchApi("/auth/platform/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` }, credentials: "include" }).catch(() => undefined);
  }
  clearPlatformSession();
}

export async function verifyPlatformSession() {
  let token = getPlatformAccessToken();
  if (!token) {
    const refreshedUser = await refreshPlatformSession();
    token = refreshedUser ? getPlatformAccessToken() : null;
  }
  if (!token) return false;

  let response = await platformRequest("/auth/platform/me", token, { method: "GET" });
  if (response.status === 401) {
    const refreshedUser = await refreshPlatformSession();
    token = refreshedUser ? getPlatformAccessToken() : null;
    if (token) response = await platformRequest("/auth/platform/me", token, { method: "GET" });
  }
  if (!response.ok) {
    clearPlatformSession();
    return false;
  }
  const data = (await response.json()) as { user: AuthUser };
  return isSuperAdmin(data.user);
}

export async function platformFetch<T>(path: string, init: RequestInit = {}) {
  let token = getPlatformAccessToken();
  if (!token) {
    const refreshedUser = await refreshPlatformSession();
    token = refreshedUser ? getPlatformAccessToken() : null;
  }
  if (!token) throw new Error("Session admin requise");

  let response = await platformRequest(path, token, init);
  if (response.status === 401) {
    const refreshedUser = await refreshPlatformSession();
    token = refreshedUser ? getPlatformAccessToken() : null;
    if (token) response = await platformRequest(path, token, init);
  }

  if (!response.ok) {
    const error = await readError(response);
    if (response.status === 401 || response.status === 403) clearPlatformSession();
    throw new Error(error);
  }
  return response.json() as Promise<T>;
}

function platformRequest(path: string, token: string, init: RequestInit) {
  return fetchApi(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });
}

function getPlatformAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(accessTokenKey);
}

function getPlatformUser() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(userKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    clearPlatformSession();
    return null;
  }
}

async function refreshPlatformSession() {
  if (typeof window === "undefined") return null;
  const refreshToken = window.localStorage.getItem(refreshTokenKey);
  if (!refreshToken) return null;
  const response = await fetchApi("/auth/platform/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ refreshToken })
  });
  if (!response.ok) {
    clearPlatformSession();
    return null;
  }
  const data = (await response.json()) as AuthResponse;
  savePlatformSession(data);
  return data.user;
}

function savePlatformSession(data: AuthResponse) {
  window.localStorage.setItem(accessTokenKey, data.accessToken);
  window.localStorage.setItem(refreshTokenKey, data.refreshToken);
  window.localStorage.setItem(userKey, JSON.stringify(data.user));
}

function clearPlatformSession() {
  window.localStorage.removeItem(accessTokenKey);
  window.localStorage.removeItem(refreshTokenKey);
  window.localStorage.removeItem(userKey);
}

function isSuperAdmin(user: AuthUser | null) {
  return Boolean(user?.roles?.some((role) => role === "SUPER_ADMIN" || role === "PlatformAdmin") || user?.role === "SUPER_ADMIN" || user?.role === "PlatformAdmin");
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return publicApiErrorMessage(Array.isArray(body.message) ? body.message[0] : body.message ?? "Accès impossible", "Accès impossible");
  } catch {
    return "Accès impossible";
  }
}

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

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const accessTokenKey = "vta_access_token";
const refreshTokenKey = "vta_refresh_token";
const userKey = "vta_user";

export async function login(payload: LoginPayload) {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error("Impossible de joindre l'API. Verifiez que le backend tourne sur http://localhost:3001.");
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
    await fetch(`${apiUrl}/auth/logout`, {
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

  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ refreshToken })
  });

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
  window.localStorage.setItem(accessTokenKey, data.accessToken);
  window.localStorage.setItem(refreshTokenKey, data.refreshToken);
  window.localStorage.setItem(userKey, JSON.stringify(data.user));
}

export function clearSession() {
  window.localStorage.removeItem(accessTokenKey);
  window.localStorage.removeItem(refreshTokenKey);
  window.localStorage.removeItem(userKey);
}

async function readApiError(response: Response) {
  try {
    const body = await response.json();
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Connexion impossible";
  } catch {
    return "Connexion impossible";
  }
}
export async function registerUser(payload: { firstName: string; lastName: string; email: string; phone?: string; password: string; confirmPassword: string; acceptedTerms: boolean }) {
  const response = await fetch(`${apiUrl}/onboarding/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<{ pendingToken: string; email: string; message: string }>;
}

export async function createCompany(payload: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/onboarding/company`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = (await response.json()) as AuthResponse;
  saveSession(data);
  return data.user;
}

export async function getOnboardingStatus() {
  const token = getAccessToken();
  if (!token) return { completed: false };
  const response = await fetch(`${apiUrl}/onboarding/status`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return { completed: false };
  return response.json() as Promise<{ completed: boolean }>;
}

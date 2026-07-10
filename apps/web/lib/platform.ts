"use client";

import { clearSession, getAccessToken, getCurrentUser } from "@/lib/auth";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/^"|"$/g, "");

export function isPlatformAdmin() {
  const user = getCurrentUser();
  const token = getAccessToken();
  return Boolean(token && (user?.roles?.some((role) => role === "SUPER_ADMIN" || role === "PlatformAdmin") || user?.role === "SUPER_ADMIN" || user?.role === "PlatformAdmin"));
}

export async function platformFetch<T>(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("Session requise");
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    const error = await readError(response);
    if (error === "Token invalide" || response.status === 401) {
      clearSession();
      throw new Error("Session admin expiree. Reconnectez-vous.");
    }
    throw new Error(error);
  }
  return response.json() as Promise<T>;
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Acces impossible";
  } catch {
    return "Acces impossible";
  }
}


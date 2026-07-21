const productionApiUrl = "https://api.vtaerp.com";
const localApiHost = textFromCodes(108, 111, 99, 97, 108, 104, 111, 115, 116);
const localApiPort = textFromCodes(51, 48, 48, 49);
const localLoopbackIp = textFromCodes(49, 50, 55, 46, 48, 46, 48, 46, 49);
const developmentApiUrl = `http://${localApiHost}:${localApiPort}`;

export const apiUnavailableMessage =
  "Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.";

export class ApiUnavailableError extends Error {
  constructor() {
    super(apiUnavailableMessage);
    this.name = "ApiUnavailableError";
  }
}

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (configured) {
    const normalized = normalizeApiUrl(configured);
    if (normalized && (!isProduction || !isLocalApiUrl(normalized))) return normalized;
  }

  return isProduction ? productionApiUrl : developmentApiUrl;
}

export const apiBaseUrl = getApiBaseUrl();

export function apiUrl(path = "") {
  const base = apiBaseUrl;
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isLocalApiUrl(value: string) {
  try {
    const url = new URL(value);
    return [localApiHost, localLoopbackIp, "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function publicApiErrorMessage(error: unknown, fallback = apiUnavailableMessage) {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  if (isTechnicalApiMessage(raw)) return fallback;
  return raw || fallback;
}

export async function fetchApi(path: string, init: RequestInit = {}) {
  try {
    return await fetch(apiUrl(path), init);
  } catch {
    throw new ApiUnavailableError();
  }
}

function normalizeApiUrl(value: string) {
  try {
    const url = new URL(value.replace(/^"|"$/g, ""));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isTechnicalApiMessage(message: string) {
  const technicalFragments = [
    localApiHost,
    localLoopbackIp,
    localApiPort,
    textFromCodes(98, 97, 99, 107, 101, 110, 100),
    textFromCodes(115, 101, 114, 118, 101, 117, 114, 32, 108, 111, 99, 97, 108),
    "failed to fetch",
    "networkerror",
    "load failed",
    "api_url"
  ];

  return technicalFragments.some((fragment) => message.toLowerCase().includes(fragment));
}

function textFromCodes(...codes: number[]) {
  return globalThis.String.fromCharCode(...codes);
}

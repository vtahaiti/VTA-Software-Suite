"use client";

import { useEffect } from "react";

const clientVersion = "2026-07-21-product-form-cache-fix";
const versionStorageKey = "vta_web_client_version";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    void refreshStaleClientCache();
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      void registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "VTA_SKIP_WAITING" });
      }
    }).catch(() => undefined);
  }, []);

  return null;
}

async function refreshStaleClientCache() {
  const currentVersion = window.localStorage.getItem(versionStorageKey);
  if (currentVersion === clientVersion) return;

  window.localStorage.setItem(versionStorageKey, clientVersion);

  if ("caches" in window) {
    const keys = await window.caches.keys().catch(() => []);
    await Promise.all(keys.filter((key) => key.startsWith("vta-commerce-")).map((key) => window.caches.delete(key))).catch(() => undefined);
  }

  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.all(registrations.map((registration) => registration.update())).catch(() => undefined);

  if (currentVersion) {
    window.location.reload();
  }
}

"use client";

import { useEffect } from "react";
import { iosEmbeddedRoutes } from "@/lib/ios-embedded-routes";

const ALLOWED_WEBVIEW_ORIGINS = new Set([
  "https://vtaerp.com",
  "https://www.vtaerp.com",
  "https://api.vtaerp.com"
]);

export function CapacitorRuntime() {
  useEffect(() => {
    let removeBackButtonListener: (() => void) | undefined;
    let removeAppUrlOpenListener: (() => void) | undefined;
    let clickHandler: ((event: MouseEvent) => void) | undefined;
    let disposed = false;

    async function setupNativeRuntime() {
      const { Capacitor } = await import("@capacitor/core");

      if (!Capacitor.isNativePlatform()) {
        return;
      }

      document.documentElement.dataset.capacitor = "true";

      const [{ App }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser")
      ]);

      if (disposed) return;

      if (Capacitor.getPlatform() === "android") {
      const backButtonHandle = await App.addListener("backButton", ({ canGoBack }) => {
        const openDialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
        const expandedMenu = document.querySelector('[aria-expanded="true"]');

        if (openDialog || expandedMenu) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          return;
        }

        if (canGoBack || window.history.length > 1) {
          window.history.back();
          return;
        }

        if (window.confirm("Quitter VTA Commerce ?")) {
          void App.exitApp();
        }
      });

      if (disposed) { await backButtonHandle.remove(); return; }
      removeBackButtonListener = () => {
        void backButtonHandle.remove();
      };

      }

      const appUrlOpenHandle = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const nextUrl = new URL(url);
          if (ALLOWED_WEBVIEW_ORIGINS.has(nextUrl.origin)) {
            window.location.href = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
          }
        } catch {
          // Ignore malformed external app links.
        }
      });

      if (disposed) { await appUrlOpenHandle.remove(); return; }
      removeAppUrlOpenListener = () => {
        void appUrlOpenHandle.remove();
      };

      clickHandler = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const anchor = target.closest<HTMLAnchorElement>("a[href]");
        if (!anchor || anchor.hasAttribute("download")) {
          return;
        }

        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#")) {
          return;
        }

        if (href.startsWith("mailto:") || href.startsWith("tel:")) {
          return;
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(href, window.location.href);
        } catch {
          event.preventDefault();
          return;
        }

        // Relative links in the embedded app use capacitor://, not https://.
        // Compare protocol and host because custom-scheme URL.origin can be null.
        if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" && nextUrl.protocol === window.location.protocol && nextUrl.host === window.location.host) {
          const route = nextUrl.pathname.replace(/\/$/, "") || "/";
          if (!iosEmbeddedRoutes.includes(route)) {
            event.preventDefault();
            if (!navigator.onLine) window.alert("Ce document nécessite une connexion Internet. Le point de vente reste disponible hors ligne.");
            else void Browser.open({ url: `https://vtaerp.com${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}` });
          }
          return;
        }
        if (nextUrl.protocol !== "https:" && nextUrl.protocol !== "http:") {
          event.preventDefault();
          return;
        }
        if (!ALLOWED_WEBVIEW_ORIGINS.has(nextUrl.origin)) {
          event.preventDefault();
          void Browser.open({ url: nextUrl.toString() });
        }
      };

      if (!disposed) {
        document.addEventListener("click", clickHandler, true);
      }
    }

    void setupNativeRuntime();

    return () => {
      disposed = true;
      removeBackButtonListener?.();
      removeAppUrlOpenListener?.();
      if (clickHandler) {
        document.removeEventListener("click", clickHandler, true);
      }
      delete document.documentElement.dataset.capacitor;
    };
  }, []);

  return null;
}

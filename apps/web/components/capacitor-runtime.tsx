"use client";

import { useEffect } from "react";

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

      removeBackButtonListener = () => {
        void backButtonHandle.remove();
      };

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

      removeAppUrlOpenListener = () => {
        void appUrlOpenHandle.remove();
      };

      clickHandler = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const anchor = target.closest<HTMLAnchorElement>("a[href]");
        if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
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

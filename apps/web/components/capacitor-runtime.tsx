"use client";

import { useEffect } from "react";
import { iosEmbeddedRoutes } from "@/lib/ios-embedded-routes";
import { resolveIosHref } from "@/lib/ios-route-map";
import { useRouter } from "next/navigation";

const ALLOWED_WEBVIEW_ORIGINS = new Set([
  "https://vtaerp.com",
  "https://www.vtaerp.com",
  "https://api.vtaerp.com"
]);

export function CapacitorRuntime() {
  const router = useRouter();
  useEffect(() => {
    let removeBackButtonListener: (() => void) | undefined;
    let removeAppUrlOpenListener: (() => void) | undefined;
    let clickHandler: ((event: MouseEvent) => void) | undefined;
    let disposed = false;
    let removeDocumentActions: (() => void) | undefined;

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

      if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" && Capacitor.getPlatform() === "ios") {
        const { installIosDocumentActions } = await import("@/lib/ios-document-actions");
        if (disposed) return;
        removeDocumentActions = installIosDocumentActions();
      }

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
            router.push(resolveIosHref(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`));
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
          const original = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
          const mapped = resolveIosHref(original);
          if (mapped !== original) {
            event.preventDefault();
            router.push(mapped);
            return;
          }
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
        if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" && ALLOWED_WEBVIEW_ORIGINS.has(nextUrl.origin)) {
          event.preventDefault();
          const mapped = resolveIosHref(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
          const route = new URL(mapped, "https://vtaerp.com").pathname.replace(/\/$/, "") || "/";
          if (nextUrl.origin !== "https://api.vtaerp.com" && iosEmbeddedRoutes.includes(route)) router.push(mapped);
          else void Browser.open({ url: nextUrl.toString() });
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
      removeDocumentActions?.();
      if (clickHandler) {
        document.removeEventListener("click", clickHandler, true);
      }
      delete document.documentElement.dataset.capacitor;
    };
  }, [router]);

  return null;
}

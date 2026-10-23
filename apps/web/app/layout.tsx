import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { CapacitorRuntime } from "@/components/capacitor-runtime";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { IosRouteFrame } from "@/components/ios-route-frame";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "VTA Commerce",
  description: "Plateforme moderne de gestion commerciale pour les entreprises.",
  manifest: "/manifest.json"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-capacitor={process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" ? "true" : undefined} data-capacitor-platform={process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" ? "ios" : undefined}>
      <body>
        <Suspense fallback={<main className="min-h-screen bg-slate-50 p-6">Chargement…</main>}><IosRouteFrame>{children}</IosRouteFrame></Suspense>
        <CapacitorRuntime />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

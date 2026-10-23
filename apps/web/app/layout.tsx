import type { Metadata, Viewport } from "next";
import { CapacitorRuntime } from "@/components/capacitor-runtime";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
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
        {children}
        <CapacitorRuntime />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

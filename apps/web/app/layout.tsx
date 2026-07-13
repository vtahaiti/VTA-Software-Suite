import type { Metadata } from "next";
import { CapacitorRuntime } from "@/components/capacitor-runtime";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

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
    <html lang="fr">
      <body>
        {children}
        <CapacitorRuntime />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

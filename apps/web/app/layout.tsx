import type { Metadata } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mon entreprise",
  description: "Plateforme de gestion commerciale",
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

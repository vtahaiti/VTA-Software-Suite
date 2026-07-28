import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion | VTA Business",
  description: "Connectez-vous à votre espace VTA Business."
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

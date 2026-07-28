import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe | VTA Business",
  description: "Choisissez un nouveau mot de passe sécurisé pour votre compte VTA Business."
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe | VTA Commerce",
  description: "Choisissez un nouveau mot de passe sécurisé pour votre compte VTA Commerce."
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

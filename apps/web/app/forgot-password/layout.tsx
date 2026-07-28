import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mot de passe oublié | VTA Business",
  description: "Demandez un lien sécurisé pour réinitialiser votre mot de passe VTA Business."
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

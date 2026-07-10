import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Créer un compte | VTA Commerce",
  description: "Créez votre compte VTA Commerce et configurez votre entreprise."
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}

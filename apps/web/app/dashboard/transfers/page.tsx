import { redirect } from "next/navigation";

// Ancienne route (systeme transferts en double, non maintenu). Redirige vers la
// version canonique sous /dashboard/inventory. Fichier garde volontairement
// (pas supprime) au cas ou un lien externe ou un favori pointe encore ici.
export default function LegacyTransfersRedirect() {
  redirect("/dashboard/inventory/transfers");
}

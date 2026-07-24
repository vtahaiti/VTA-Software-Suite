import { redirect } from "next/navigation";

export default function SettingsSecurityRedirect() {
  redirect("/dashboard/security");
}

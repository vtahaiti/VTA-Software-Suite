import { redirect } from "next/navigation";

export default function SettingsActivityRedirect() {
  redirect("/dashboard/settings/business-modules");
}

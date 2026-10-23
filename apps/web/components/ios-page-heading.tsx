import Link from "next/link";
export function IosPageHeading({ title }: { title: string }) {
  return <div className="vm-settings-heading"><Link href="/dashboard/settings">Paramètres</Link><h1>{title}</h1></div>;
}

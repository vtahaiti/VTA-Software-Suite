import { ProtectedShell } from "@/components/protected-shell";

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
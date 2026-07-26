import { ExcludedModuleGuard } from "@/components/excluded-module-guard";

export default function ProformasLayout({ children }: { children: React.ReactNode }) {
  return (
    <ExcludedModuleGuard moduleKey="sales" redirectTo="/dashboard/sales/in-progress">
      {children}
    </ExcludedModuleGuard>
  );
}

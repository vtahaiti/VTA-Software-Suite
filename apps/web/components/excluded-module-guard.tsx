"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTenantBusinessConfiguration } from "@/lib/business-profiles";

type ExcludedModuleGuardProps = {
  moduleKey: string;
  redirectTo: string;
  children: ReactNode;
};

// Bloque l'acces direct par URL a une page dont le module metier est exclu pour le profil du tenant
// (ex: Devis & Commandes pour Restaurant), meme si le lien est masque du menu et meme pour un
// role admin/owner qui a par ailleurs toutes les permissions. La navigation.tsx cache le lien ; ce
// composant empeche l'acces direct.
export function ExcludedModuleGuard({ moduleKey, redirectTo, children }: ExcludedModuleGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "allowed" | "blocked">("checking");

  useEffect(() => {
    let cancelled = false;
    getTenantBusinessConfiguration()
      .then((config) => {
        if (cancelled) return;
        if (config?.excludedModules?.includes(moduleKey)) {
          setState("blocked");
          router.replace(redirectTo);
        } else {
          setState("allowed");
        }
      })
      .catch(() => {
        if (!cancelled) setState("allowed");
      });
    return () => { cancelled = true; };
  }, [moduleKey, redirectTo, router]);

  if (state !== "allowed") return null;
  return <>{children}</>;
}

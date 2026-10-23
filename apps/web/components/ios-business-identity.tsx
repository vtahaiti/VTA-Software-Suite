"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, ChevronRight } from "lucide-react";
import { getBusinessCatalog, getTenantBusinessConfiguration, type TenantBusinessConfiguration } from "@/lib/business-profiles";
import { canAccessHref } from "@/lib/role-access";
import { getCurrentUser } from "@/lib/auth";

export function IosBusinessIdentity() {
  const [configuration, setConfiguration] = useState<TenantBusinessConfiguration | null>(null);
  const [sector, setSector] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false);
    Promise.all([getBusinessCatalog(), getTenantBusinessConfiguration()]).then(([catalog, tenant]) => {
      if (!tenant) throw new Error();
      if (!active) return;
      setConfiguration(tenant);
      setSector(catalog.categories?.find(category => category.key === tenant.businessCategory)?.name ?? "");
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("vta:business-profile-updated", refresh);
    return () => { active = false; window.removeEventListener("vta:business-profile-updated", refresh); };
  }, [revision]);
  const canEdit = canAccessHref(getCurrentUser(), "/dashboard/settings/business-modules");
  return <section className="vm-business-identity" aria-label="Type et activité de l’entreprise"><div className="vm-business-identity-title"><span><Building2 size={21}/></span><div><h2>Type d’entreprise</h2><p>Votre activité et les fonctions de votre boutique.</p></div></div>{loading ? <p role="status" className="vm-form-help">Chargement de votre activité…</p> : failed ? <div role="alert" className="vm-form-help">Activité indisponible pour le moment.<button type="button" className="vm-inline-action" onClick={() => setRevision(value => value + 1)}>Réessayer</button></div> : <><strong className="vm-business-current-type">{configuration?.primaryActivity || "À renseigner"}</strong><dl className="vm-detail-rows"><div><dt>Secteur</dt><dd>{sector || "Non renseigné"}</dd></div><div><dt>Modules actifs</dt><dd>{configuration?.modules.length ?? 0}</dd></div>{Boolean(configuration?.secondaryActivities?.length) && <div><dt>Autres activités</dt><dd>{configuration?.secondaryActivities?.join(", ")}</dd></div>}</dl></>}{canEdit && <Link href="/dashboard/settings/business-modules" className="vm-business-edit">Configurer le type et l’activité<ChevronRight size={17}/></Link>}</section>;
}

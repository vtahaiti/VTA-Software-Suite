"use client";

import Link from "next/link";
import { hasBusinessSelectionChanges } from "@/lib/business-selection";
import { IosPageHeading } from "@/components/ios-page-heading";
import { useEffect, useMemo, useState } from "react";
import { getBusinessCatalog, getTenantBusinessConfiguration, setBusinessModuleState, updateBusinessSelection, type BusinessCategory, type BusinessModule, type TenantBusinessConfiguration } from "@/lib/business-profiles";

export default function BusinessModulesPage() {
  const [saving, setSaving] = useState(false);
  const [updatingModule, setUpdatingModule] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [catalogModules, setCatalogModules] = useState<BusinessModule[]>([]);
  const [configuration, setConfiguration] = useState<TenantBusinessConfiguration | null>(null);
  const [businessCategory, setBusinessCategory] = useState("");
  const [primaryActivity, setPrimaryActivity] = useState("");
  const [secondaryActivities, setSecondaryActivities] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true); setLoadError("");
    try {
    const [catalog, tenant] = await Promise.all([getBusinessCatalog(), getTenantBusinessConfiguration()]);
    if (!tenant || !catalog.categories?.length) throw new Error();
    setCategories(catalog.categories);
    setCatalogModules(catalog.modules ?? []);
    applyConfiguration(tenant);
    } catch { setLoadError("Impossible de charger votre activité. Réessayez."); } finally { setLoading(false); }
  }

  function applyConfiguration(next: TenantBusinessConfiguration) {
    setConfiguration(next);
    setBusinessCategory(next.businessCategory ?? "");
    setPrimaryActivity(next.primaryActivity ?? "");
    setSecondaryActivities(next.secondaryActivities ?? []);
  }
  const selectedCategory = categories.find(category => category.key === businessCategory);
  const selectionChanged = hasBusinessSelectionChanges(configuration, businessCategory, primaryActivity, secondaryActivities);
  const validSelection = Boolean(selectedCategory?.activities.some(activity => activity.name === primaryActivity));
  const activeModuleKeys = useMemo(() => new Set(configuration?.modules.map((module) => module.key) ?? []), [configuration]);
  const allowedModuleKeys = useMemo(() => new Set(configuration?.allowedModuleKeys ?? []), [configuration]);
  const excludedModuleKeys = useMemo(() => new Set(configuration?.excludedModules ?? []), [configuration]);
  const visibleCatalogModules = useMemo(
    () => catalogModules.filter((module) => allowedModuleKeys.has(module.key) && !excludedModuleKeys.has(module.key)),
    [allowedModuleKeys, catalogModules, excludedModuleKeys]
  );

  function changeCategory(value: string) {
    const category = categories.find((item) => item.key === value) ?? categories[0];
    if (!category) return;
    setBusinessCategory(category.key);
    setPrimaryActivity(category.activities[0]?.name ?? "Autre activité");
    setSecondaryActivities([]);
  }

  async function saveSelection() {
    if (loading || loadError || saving || updatingModule || !validSelection || !selectionChanged) return;
    setMessage("");
    const confirmed = window.confirm("Changer l'activité modifiera les menus et fonctionnalités visibles, mais ne supprimera pas vos données.");
    if (!confirmed) return;
    setSaving(true);
    try {
      applyConfiguration(await updateBusinessSelection({ businessCategory, primaryActivity, secondaryActivities }));
      window.dispatchEvent(new CustomEvent("vta:business-profile-updated"));
      setMessage("Activité mise à jour. Vos menus sont actualisés.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    } finally { setSaving(false); }
  }

  async function toggleModule(key: string, isActive: boolean) {
    if (loading || loadError || saving || updatingModule || selectionChanged) return;
    setUpdatingModule(key);
    setMessage("");
    try {
      applyConfiguration(await setBusinessModuleState(key, isActive));
      window.dispatchEvent(new CustomEvent("vta:business-profile-updated"));
      setMessage("Module mis à jour.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    } finally { setUpdatingModule(null); }
  }

  function toggleSecondary(activity: string) {
    setSecondaryActivities((current) => current.includes(activity) ? current.filter((item) => item !== activity) : [...current, activity]);
  }

  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1") return <div className="vm-screen vm-settings-screen"><IosPageHeading title="Type et activité"/><p className="vm-form-help">Le type d’entreprise détermine les fonctions proposées dans votre boutique.</p><Link href="/dashboard/settings/company" className="vm-business-edit">Voir Mon entreprise ›</Link>{loading ? <p role="status">Chargement…</p> : loadError ? <div className="vm-settings-notice" role="alert">{loadError}<button onClick={() => void load()}>Réessayer</button></div> : <><section className="vm-settings-panel vm-settings-form"><p className="vm-form-help">Activité enregistrée : <strong>{configuration?.primaryActivity || "À renseigner"}</strong></p><label>Secteur<select disabled={saving || Boolean(updatingModule)} value={businessCategory} onChange={event => changeCategory(event.target.value)}>{!selectedCategory && <option value={businessCategory}>Choisir un secteur</option>}{categories.map(category => <option key={category.key} value={category.key}>{category.name}</option>)}</select></label><label>Type d’entreprise / activité principale<select disabled={saving || Boolean(updatingModule)} value={primaryActivity} onChange={event => setPrimaryActivity(event.target.value)}>{!validSelection && <option value={primaryActivity}>{primaryActivity || "Choisir une activité"}</option>}{selectedCategory?.activities.map(activity => <option key={activity.name}>{activity.name}</option>)}</select></label>{businessCategory === "multi-activities" && <details className="vm-permission-group"><summary>Activités secondaires<span>⌄</span></summary>{selectedCategory?.activities.map(activity => <label className="vm-permission-choice" key={activity.name}><span>{activity.name}</span><input type="checkbox" checked={secondaryActivities.includes(activity.name)} onChange={() => toggleSecondary(activity.name)}/></label>)}</details>}<p className="vm-form-help">Le changement d’activité adapte vos menus et conserve vos données.</p>{selectionChanged && <p className="vm-business-draft-note" role="status">Modification non enregistrée. Enregistrez ce type d’activité pour actualiser les menus et modules.</p>}<button disabled={saving || Boolean(updatingModule) || !validSelection || !selectionChanged} className="vm-primary-button" onClick={() => void saveSelection()}>{saving ? "Enregistrement…" : "Enregistrer le type d’activité"}</button></section><section className="vm-permission-catalogue"><h2>Modules de l’activité enregistrée</h2><p className="vm-form-help">Ces fonctions suivent le type enregistré et les droits de votre équipe.</p><div className="vm-settings-cards">{visibleCatalogModules.map(module => <label key={module.key} className="vm-module-choice"><span><strong>{module.name}</strong><small>{module.description}</small></span><input type="checkbox" disabled={selectionChanged || saving || Boolean(updatingModule)} checked={activeModuleKeys.has(module.key)} onChange={event => void toggleModule(module.key, event.target.checked)}/></label>)}</div></section></>}{message && <p role="status" className="vm-settings-notice">{message}</p>}</div>;
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Paramètres</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Activité et modules</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Choisissez le secteur et l&apos;activité principale de l&apos;entreprise. VTA recalcule les menus visibles selon ce profil et le rôle utilisateur.</p>
        {message ? <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-slate-800 dark:text-brand-200">{message}</p> : null}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Profil d&apos;activité</h2>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Changer l&apos;activité modifiera les menus et fonctionnalités visibles, mais ne supprimera pas vos données.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Secteur
            <select value={businessCategory} onChange={(event) => changeCategory(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              {categories.map((category) => <option key={category.key} value={category.key}>{category.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Activité principale
            <select value={primaryActivity} onChange={(event) => setPrimaryActivity(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              {selectedCategory?.activities.map((activity) => <option key={activity.name} value={activity.name}>{activity.name}</option>)}
            </select>
          </label>
        </div>

        {businessCategory === "multi-activities" ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Activités secondaires</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {selectedCategory?.activities.map((activity) => (
                <label key={activity.name} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={secondaryActivities.includes(activity.name)} onChange={() => toggleSecondary(activity.name)} />
                  {activity.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <button onClick={saveSelection} className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer l&apos;activité</button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Modules visibles</h2>
        <p className="text-sm text-slate-500">Ces modules suivent la matrice métier actuelle. Les données existantes restent conservées même si un module n&apos;est plus affiché par défaut.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleCatalogModules.map((module) => (
            <label key={module.key} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <input type="checkbox" checked={activeModuleKeys.has(module.key)} onChange={(event) => toggleModule(module.key, event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="block text-sm font-semibold text-slate-950 dark:text-white">{module.name}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{module.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">Interface simplifiée par défaut : la sidebar garde uniquement les menus principaux. L&apos;interface complète affiche davantage de menus autorisés, sans ajouter de droits métier.</div>
    </div>
  );
}

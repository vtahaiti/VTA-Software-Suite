"use client";
import { useEffect, useMemo, useState } from "react";
import { getBusinessCatalog, getTenantBusinessConfiguration, setBusinessModuleState, updateBusinessSelection, type BusinessCategory, type BusinessModule, type TenantBusinessConfiguration } from "@/lib/business-profiles";

export default function BusinessModulesPage() {
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [catalogModules, setCatalogModules] = useState<BusinessModule[]>([]);
  const [configuration, setConfiguration] = useState<TenantBusinessConfiguration | null>(null);
  const [businessCategory, setBusinessCategory] = useState("commerce");
  const [primaryActivity, setPrimaryActivity] = useState("Boutique / Market");
  const [secondaryActivities, setSecondaryActivities] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const [catalog, tenant] = await Promise.all([getBusinessCatalog(), getTenantBusinessConfiguration()]);
    setCategories(catalog.categories);
    setCatalogModules(catalog.modules);
    setConfiguration(tenant);
    setBusinessCategory(tenant?.businessCategory ?? catalog.categories[0]?.key ?? "commerce");
    setPrimaryActivity(tenant?.primaryActivity ?? catalog.categories[0]?.activities[0]?.name ?? "Boutique / Market");
    setSecondaryActivities(tenant?.secondaryActivities ?? []);
  }

  const selectedCategory = categories.find((category) => category.key === businessCategory) ?? categories[0];
  const activeModuleKeys = useMemo(() => new Set(configuration?.modules.map((module) => module.key) ?? []), [configuration]);

  function changeCategory(value: string) {
    const category = categories.find((item) => item.key === value) ?? categories[0];
    setBusinessCategory(category.key);
    setPrimaryActivity(category.activities[0]?.name ?? "Autre activitÃ©");
    setSecondaryActivities([]);
  }

  async function saveSelection() {
    setMessage("");
    try {
      setConfiguration(await updateBusinessSelection({ businessCategory, primaryActivity, secondaryActivities }));
      setMessage("ActivitÃ© mise a jour. La sidebar et le dashboard s'adaptent automatiquement.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    }
  }

  async function toggleModule(key: string, isActive: boolean) {
    setMessage("");
    try { setConfiguration(await setBusinessModuleState(key, isActive)); setMessage("Module mis a jour."); } catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); }
  }

  function toggleSecondary(activity: string) {
    setSecondaryActivities((current) => current.includes(activity) ? current.filter((item) => item !== activity) : [...current, activity]);
  }

  return <div className="space-y-6"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">ParamÃ¨tres</p><h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Business Modules</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Choisissez une catÃ©gorie simple, une activitÃ© principale, puis activez uniquement les modules utiles.</p>{message ? <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-slate-800 dark:text-brand-200">{message}</p> : null}</div><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-bold text-slate-950 dark:text-white">ActivitÃ© de l&apos;entreprise</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">CatÃ©gorie mÃ©tier<select value={businessCategory} onChange={(event)=>changeCategory(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">{categories.map((category)=><option key={category.key} value={category.key}>{category.name}</option>)}</select></label><label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">ActivitÃ© principale<select value={primaryActivity} onChange={(event)=>setPrimaryActivity(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">{selectedCategory?.activities.map((activity)=><option key={activity.name} value={activity.name}>{activity.name}</option>)}</select></label></div>{businessCategory === "multi-activities" ? <div className="mt-4"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">ActivitÃ©s secondaires</p><div className="mt-3 grid gap-2 md:grid-cols-2">{selectedCategory?.activities.map((activity)=><label key={activity.name} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={secondaryActivities.includes(activity.name)} onChange={()=>toggleSecondary(activity.name)} />{activity.name}</label>)}</div></div> : null}<button onClick={saveSelection} className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer l&apos;activitÃ©</button></section><section className="space-y-3"><h2 className="text-lg font-bold text-slate-950 dark:text-white">Modules activables</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{catalogModules.map((module)=><label key={module.key} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><input type="checkbox" checked={activeModuleKeys.has(module.key)} onChange={(event)=>toggleModule(module.key, event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300"/><span><span className="block text-sm font-semibold text-slate-950 dark:text-white">{module.name}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{module.description}</span></span></label>)}</div></section><div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">Interface simplifiée par défaut : la sidebar garde uniquement les menus principaux. L&apos;interface complète affiche davantage de menus autorisés, sans ajouter de droits métier.</div></div>;
}

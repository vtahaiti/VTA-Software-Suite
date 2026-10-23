import type { TenantBusinessConfiguration } from "./business-profiles";

export function hasBusinessSelectionChanges(configuration: TenantBusinessConfiguration | null, category: string, activity: string, secondary: string[]) {
  if (!configuration) return false;
  const saved = new Set(configuration.secondaryActivities ?? []);
  const selected = new Set(secondary);
  return category !== (configuration.businessCategory ?? "")
    || activity !== (configuration.primaryActivity ?? "")
    || saved.size !== selected.size
    || [...saved].some(value => !selected.has(value));
}

export const DEFAULT_BUSINESS_TIME_ZONE = "America/Port-au-Prince";

export function businessTimeZone() {
  return DEFAULT_BUSINESS_TIME_ZONE;
}

export function formatBusinessDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-HT", {
    timeZone: businessTimeZone(),
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatBusinessDate(value: string | number | Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-HT", {
    timeZone: businessTimeZone(),
    dateStyle: "medium"
  }).format(new Date(value));
}

export function businessDateKey(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

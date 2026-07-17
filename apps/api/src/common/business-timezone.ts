export const DEFAULT_BUSINESS_TIME_ZONE = "America/Port-au-Prince";

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function normalizeBusinessTimeZone(value?: string | null) {
  if (!value) return DEFAULT_BUSINESS_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_BUSINESS_TIME_ZONE;
  }
}

export function formatBusinessDateTime(value: Date | string | number, timeZone?: string | null) {
  return new Intl.DateTimeFormat("fr-HT", {
    timeZone: normalizeBusinessTimeZone(timeZone),
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function businessDateKey(value: Date | string | number, timeZone?: string | null) {
  const parts = zonedParts(new Date(value), normalizeBusinessTimeZone(timeZone));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function businessDayRange(value: Date = new Date(), timeZone?: string | null) {
  const zone = normalizeBusinessTimeZone(timeZone);
  const parts = zonedParts(value, zone);
  const start = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, 0, zone);
  const next = addLocalDays(parts, 1);
  const end = zonedDateTimeToUtc(next.year, next.month, next.day, 0, 0, 0, 0, zone);
  return { start, end, timeZone: zone };
}

export function businessDayRangeForDateKey(dateKey: string, timeZone?: string | null) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  const zone = normalizeBusinessTimeZone(timeZone);
  if (!year || !month || !day) return businessDayRange(new Date(), zone);
  const start = zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0, zone);
  const next = addLocalDays({ year, month, day }, 1);
  const end = zonedDateTimeToUtc(next.year, next.month, next.day, 0, 0, 0, 0, zone);
  return { start, end, timeZone: zone };
}

export function businessMonthRange(value: Date = new Date(), timeZone?: string | null) {
  const zone = normalizeBusinessTimeZone(timeZone);
  const parts = zonedParts(value, zone);
  const start = zonedDateTimeToUtc(parts.year, parts.month, 1, 0, 0, 0, 0, zone);
  const nextMonth = parts.month === 12 ? { year: parts.year + 1, month: 1 } : { year: parts.year, month: parts.month + 1 };
  const end = zonedDateTimeToUtc(nextMonth.year, nextMonth.month, 1, 0, 0, 0, 0, zone);
  return { start, end, timeZone: zone };
}

export function businessYearRange(value: Date = new Date(), timeZone?: string | null) {
  const zone = normalizeBusinessTimeZone(timeZone);
  const parts = zonedParts(value, zone);
  const start = zonedDateTimeToUtc(parts.year, 1, 1, 0, 0, 0, 0, zone);
  const end = zonedDateTimeToUtc(parts.year + 1, 1, 1, 0, 0, 0, 0, zone);
  return { start, end, timeZone: zone };
}

export function addBusinessDays(value: Date, days: number, timeZone?: string | null) {
  const zone = normalizeBusinessTimeZone(timeZone);
  const parts = addLocalDays(zonedParts(value, zone), days);
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, 0, zone);
}

function zonedParts(value: Date, timeZone: string): ZonedParts {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).formatToParts(value);
  const get = (type: string) => Number(formatted.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function addLocalDays(parts: Pick<ZonedParts, "year" | "month" | "day">, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond: number, timeZone: string) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

function timeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - value.getTime();
}

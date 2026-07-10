export function formatMoney(value: number | string | null | undefined, currency = "HTG") {
  const numeric = typeof value === "string" ? Number(value) : value;
  const amount = Number.isFinite(Number(numeric)) ? Number(numeric) : 0;
  return new Intl.NumberFormat("fr-HT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function pluralize(count: number, singular: string, plural?: string) {
  const label = count === 1 ? singular : (plural ?? singular + "s");
  return `${new Intl.NumberFormat("fr-HT").format(count)} ${label}`;
}

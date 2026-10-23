// Renew on the same UTC calendar day, clamped to the last day of the next month.
export function nextMonthlyPeriodEnd(start: Date): Date {
  const end = new Date(start.getTime());
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return end;
}

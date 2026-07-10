export type PaymentSnapshot = {
  amount?: number | string | null;
  receivedAmount?: number | string | null;
  changeAmount?: number | string | null;
};

function numeric(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function summarizePayments(totalValue: number | string | null | undefined, payments: PaymentSnapshot[] = []) {
  const total = round(numeric(totalValue));
  const rawSettled = round(payments.reduce((sum, payment) => sum + numeric(payment.amount), 0));
  const explicitReceived = payments.some((payment) => payment.receivedAmount !== null && payment.receivedAmount !== undefined);
  const explicitChange = payments.some((payment) => payment.changeAmount !== null && payment.changeAmount !== undefined && numeric(payment.changeAmount) > 0);
  const receivedAmount = round(payments.reduce((sum, payment) => sum + numeric(payment.receivedAmount ?? payment.amount), 0));
  const recordedChange = round(payments.reduce((sum, payment) => sum + numeric(payment.changeAmount), 0));

  if (!payments.length) return { total, settledAmount: 0, receivedAmount: 0, changeAmount: 0, historicalDataUnavailable: false };

  if (!explicitReceived && !explicitChange && rawSettled > total && total > 0) {
    return { total, settledAmount: total, receivedAmount: rawSettled, changeAmount: round(rawSettled - total), historicalDataUnavailable: false };
  }

  const changeAmount = explicitChange ? recordedChange : round(Math.max(0, receivedAmount - total));
  return {
    total,
    settledAmount: round(Math.min(rawSettled, total)),
    receivedAmount,
    changeAmount,
    historicalDataUnavailable: receivedAmount === 0 && rawSettled === 0 && total > 0
  };
}

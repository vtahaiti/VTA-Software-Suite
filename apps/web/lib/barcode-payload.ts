export type NormalizedBarcodePayload = {
  value: string;
  format: string | null;
  cancelled: boolean;
};

type BarcodeLike = {
  rawValue?: unknown;
  displayValue?: unknown;
  value?: unknown;
  text?: unknown;
  format?: unknown;
  cancelled?: unknown;
  canceled?: unknown;
  barcodes?: unknown;
};

export function normalizeBarcodePayload(input: unknown): NormalizedBarcodePayload {
  if (input == null) return emptyBarcode(false);
  if (typeof input === "string" || typeof input === "number") {
    return fromValue(input, null, false);
  }
  if (Array.isArray(input)) {
    return normalizeBarcodePayload(input[0]);
  }
  if (typeof input !== "object") return emptyBarcode(false);

  const payload = input as BarcodeLike;
  const cancelled = payload.cancelled === true || payload.canceled === true;
  if (cancelled) return emptyBarcode(true);

  if (Array.isArray(payload.barcodes)) {
    return normalizeBarcodePayload(payload.barcodes[0]);
  }

  const value = firstStringLike(payload.rawValue, payload.displayValue, payload.value, payload.text);
  const format = firstStringLike(payload.format);
  return fromValue(value, format, false);
}

function firstStringLike(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return "";
}

function fromValue(value: unknown, format: unknown, cancelled: boolean): NormalizedBarcodePayload {
  const normalizedValue = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  const normalizedFormat = typeof format === "string" || typeof format === "number" ? String(format).trim() : "";
  return {
    value: normalizedValue,
    format: normalizedFormat || null,
    cancelled: cancelled || !normalizedValue
  };
}

function emptyBarcode(cancelled: boolean): NormalizedBarcodePayload {
  return { value: "", format: null, cancelled };
}

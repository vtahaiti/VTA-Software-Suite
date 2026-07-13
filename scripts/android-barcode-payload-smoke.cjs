const assert = require("node:assert/strict");

function normalizeBarcodePayload(input) {
  if (input == null) return emptyBarcode(false);
  if (typeof input === "string" || typeof input === "number") return fromValue(input, null, false);
  if (Array.isArray(input)) return normalizeBarcodePayload(input[0]);
  if (typeof input !== "object") return emptyBarcode(false);

  const cancelled = input.cancelled === true || input.canceled === true;
  if (cancelled) return emptyBarcode(true);
  if (Array.isArray(input.barcodes)) return normalizeBarcodePayload(input.barcodes[0]);

  const value = firstStringLike(input.rawValue, input.displayValue, input.value, input.text);
  const format = firstStringLike(input.format);
  return fromValue(value, format, false);
}

function firstStringLike(...values) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return "";
}

function fromValue(value, format, cancelled) {
  const normalizedValue = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  const normalizedFormat = typeof format === "string" || typeof format === "number" ? String(format).trim() : "";
  return { value: normalizedValue, format: normalizedFormat || null, cancelled: cancelled || !normalizedValue };
}

function emptyBarcode(cancelled) {
  return { value: "", format: null, cancelled };
}

const cases = [
  ["string", " 0123456789012 ", { value: "0123456789012", format: null, cancelled: false }],
  ["number", 123456789012, { value: "123456789012", format: null, cancelled: false }],
  ["object rawValue", { rawValue: "5901234123457", format: "EAN_13" }, { value: "5901234123457", format: "EAN_13", cancelled: false }],
  ["array", [{ displayValue: "036000291452", format: "UPC_A" }], { value: "036000291452", format: "UPC_A", cancelled: false }],
  ["mlkit result", { barcodes: [{ rawValue: "QR-VTA-TEST", format: "QR_CODE" }] }, { value: "QR-VTA-TEST", format: "QR_CODE", cancelled: false }],
  ["null", null, { value: "", format: null, cancelled: false }],
  ["undefined", undefined, { value: "", format: null, cancelled: false }],
  ["cancelled", { cancelled: true }, { value: "", format: null, cancelled: true }],
  ["empty result", { barcodes: [] }, { value: "", format: null, cancelled: false }],
  ["plain object rejected", { foo: "bar" }, { value: "", format: null, cancelled: true }]
];

for (const [name, input, expected] of cases) {
  assert.deepEqual(normalizeBarcodePayload(input), expected, name);
}

console.log(`android-barcode-payload-smoke: ${cases.length} cases passed`);

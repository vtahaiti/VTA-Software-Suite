import { getAccessToken } from "@/lib/auth";
import { downloadAuthenticatedFile } from "@/lib/authenticated-download";
import { isNativePrintAvailable, printHtmlNative, type NativePrintFormat } from "@/lib/native-print";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ReceiptWidth = "58" | "72" | "80";

type PrintPreviewOptions = {
  autoPrint?: boolean;
  width?: ReceiptWidth;
};

type PrintHtmlContentOptions = {
  title?: string;
  format?: NativePrintFormat;
};

export async function getReceiptPrintSettings(): Promise<{ width: ReceiptWidth; autoPrintReceipt: boolean }> {
  const token = getAccessToken();
  const [invoicingResponse, posResponse] = await Promise.all([
    fetch(`${apiUrl}/settings/invoicing`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${apiUrl}/settings/pos`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
  ]);

  const invoicing = invoicingResponse?.ok ? await invoicingResponse.json().catch(() => null) : null;
  const pos = posResponse?.ok ? await posResponse.json().catch(() => null) : null;
  const width = normalizeReceiptWidth(invoicing?.posReceiptFormat);
  return { width, autoPrintReceipt: Boolean(pos?.autoPrintReceipt) };
}

export async function openThermalDemoPreview(width: ReceiptWidth = "80") {
  await openInternalOrPopup(`/dashboard/pos/print?demo=1&width=${width}`);
}

export async function openPrintPreview(path: string, options: PrintPreviewOptions = {}) {
  const width = options.width ?? "80";
  const params = new URLSearchParams({ path, width });
  if (options.autoPrint) params.set("autoPrint", "1");
  await openInternalOrPopup(`/dashboard/pos/print?${params.toString()}`);
}

export async function printHtml(path: string) {
  await openPrintPreview(path);
}

export async function printHtmlContent(html: string, options: PrintHtmlContentOptions = {}) {
  if (await isNativePrintAvailable()) {
    await printHtmlNative({ html, title: options.title, format: options.format ?? "A4" });
    return;
  }

  await printHtmlInHiddenFrame(html);
}

export async function downloadPdf(path: string, filename: string) {
  await downloadAuthenticatedFile(`${apiUrl}${path}`, filename);
}

async function openInternalOrPopup(url: string) {
  window.location.assign(url);
}

function normalizeReceiptWidth(value: unknown): ReceiptWidth {
  return value === "58" || value === "72" || value === "80" ? value : "80";
}

async function printHtmlInHiddenFrame(html: string) {
  const iframe = document.createElement("iframe");
  iframe.title = "Impression VTA Commerce";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error("Impression impossible pour le moment.");
    doc.open();
    doc.write(html);
    doc.close();
    await waitForPrintableDocument(doc);
    win.focus();
    win.print();
  } finally {
    window.setTimeout(() => iframe.remove(), 1500);
  }
}

async function waitForPrintableDocument(doc: Document) {
  if (doc.fonts?.ready) await doc.fonts.ready.catch(() => undefined);
  const images = Array.from(doc.images ?? []);
  await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  })));
}

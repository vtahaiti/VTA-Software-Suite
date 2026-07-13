import { getAccessToken } from "@/lib/auth";
import { isNativePrintAvailable, printHtmlNative, type NativePrintFormat } from "@/lib/native-print";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ReceiptWidth = "58" | "80";

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
  const width = invoicing?.posReceiptFormat === "58" ? "58" : "80";
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

  const preview = window.open("", "_blank", "noopener,noreferrer");
  if (!preview) {
    throw new Error("Le navigateur a bloqué l'aperçu d'impression. Autorisez les pop-ups pour VTA Commerce, puis réessayez.");
  }
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
  preview.focus?.();
  preview.print();
}

export async function downloadPdf(path: string, filename: string) {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!response.ok) throw new Error("Téléchargement PDF impossible");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

async function openInternalOrPopup(url: string) {
  if (await isNativePrintAvailable()) {
    window.location.assign(url);
    return;
  }

  const preview = window.open(url, "_blank", "noopener,noreferrer");
  if (!preview) {
    throw new Error("Le navigateur a bloqué l'aperçu du ticket. Autorisez les pop-ups pour VTA Commerce, puis réessayez.");
  }
  preview.focus?.();
}

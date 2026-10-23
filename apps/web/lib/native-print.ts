"use client";

import { registerPlugin } from "@capacitor/core";
import { getDefaultBluetoothPrinter, printTicketOverBluetooth } from "@/lib/native-bluetooth-print";

export type NativePrintFormat = "58" | "80" | "A4" | "LETTER";
export type NativePrintOrientation = "portrait" | "landscape";

type NativePrintPlugin = {
  shareFile(options: { base64: string; fileName: string }): Promise<{ status: string }>;
  printHtml(options: {
    html: string;
    title?: string;
    format?: NativePrintFormat;
    orientation?: NativePrintOrientation;
  }): Promise<{ status: string }>;
  sharePdf(options: {
    html: string;
    title?: string;
    fileName?: string;
    format?: NativePrintFormat;
    orientation?: NativePrintOrientation;
  }): Promise<{ uri?: string; status: string }>;
};

const NativePrint = registerPlugin<NativePrintPlugin>("VtaNativePrint");

export async function shareFileNative(blob: Blob, fileName: string) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
  return NativePrint.shareFile({ base64, fileName });
}

export async function isNativePrintAvailable() {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("VtaNativePrint");
  } catch {
    return false;
  }
}

export async function printHtmlNative(options: {
  html: string;
  title?: string;
  format?: NativePrintFormat;
  orientation?: NativePrintOrientation;
}) {
  const html = /<img\b/i.test(options.html) ? await (await import("@/lib/receipt-images")).prepareReceiptImages(options.html) : options.html;
  return NativePrint.printHtml({
    title: "VTA Commerce",
    format: "80",
    orientation: "portrait",
    ...options, html
  });
}

/**
 * Imprime le ticket sans aucune boite de dialogue si une imprimante Bluetooth par defaut est
 * configuree (Parametres POS). Sinon, retombe sur l'impression native habituelle (PrintManager).
 */
export async function printReceiptSmart(options: {
  html: string;
  title?: string;
  format?: NativePrintFormat;
  widthDots?: number;
}) {
  const printer = await getDefaultBluetoothPrinter();
  if (printer.configured) {
    // A partial BLE write must never silently fall back to a second print.
    await printTicketOverBluetooth(options.html, options.widthDots ?? (options.format === "58" ? 384 : 576), printer.address);
    return { status: "printed-bluetooth" as const };
  }
  return printHtmlNative(options);
}

export async function sharePdfNative(options: {
  html: string;
  title?: string;
  fileName?: string;
  format?: NativePrintFormat;
  orientation?: NativePrintOrientation;
}) {
  const html = /<img\b/i.test(options.html) ? await (await import("@/lib/receipt-images")).prepareReceiptImages(options.html) : options.html;
  return NativePrint.sharePdf({
    title: "VTA Commerce",
    fileName: "vta-commerce.pdf",
    format: "80",
    orientation: "portrait",
    ...options, html
  });
}

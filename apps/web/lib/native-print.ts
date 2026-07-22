"use client";

import { registerPlugin } from "@capacitor/core";
import { getDefaultBluetoothPrinter, printTicketOverBluetooth } from "@/lib/native-bluetooth-print";

export type NativePrintFormat = "58" | "80" | "A4" | "LETTER";
export type NativePrintOrientation = "portrait" | "landscape";

type NativePrintPlugin = {
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

export async function isNativePrintAvailable() {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
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
  return NativePrint.printHtml({
    title: "VTA Commerce",
    format: "80",
    orientation: "portrait",
    ...options
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
  try {
    const printer = await getDefaultBluetoothPrinter();
    if (printer.configured) {
      await printTicketOverBluetooth(options.html, options.widthDots ?? 384);
      return { status: "printed-bluetooth" as const };
    }
  } catch {
    // Pas d'imprimante Bluetooth disponible ou erreur : on retombe sur l'impression classique.
  }
  await printHtmlNative(options);
  return { status: "printed-dialog" as const };
}

export async function sharePdfNative(options: {
  html: string;
  title?: string;
  fileName?: string;
  format?: NativePrintFormat;
  orientation?: NativePrintOrientation;
}) {
  return NativePrint.sharePdf({
    title: "VTA Commerce",
    fileName: "vta-commerce.pdf",
    format: "80",
    orientation: "portrait",
    ...options
  });
}

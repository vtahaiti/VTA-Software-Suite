"use client";

import { registerPlugin } from "@capacitor/core";

export type PairedPrinter = { name: string; address: string };
export type DefaultPrinter = { configured: boolean; address?: string; name?: string };

type VtaBluetoothPrinterPlugin = {
  isAvailable(): Promise<{ available: boolean; enabled?: boolean }>;
  openBluetoothSettings(): Promise<void>;
  listPaired(): Promise<{ devices: PairedPrinter[] }>;
  getDefaultPrinter(): Promise<DefaultPrinter>;
  setDefaultPrinter(options: { address: string; name?: string }): Promise<void>;
  clearDefaultPrinter(): Promise<void>;
  printTicket(options: { html: string; address?: string; widthDots?: number }): Promise<{ status: string; address: string }>;
};

const BluetoothPrinter = registerPlugin<VtaBluetoothPrinterPlugin>("VtaBluetoothPrinter");

export async function isBluetoothPrintSupported() {
  if (typeof window === "undefined") return { available: false, enabled: undefined };
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return { available: false, enabled: undefined };
    return await BluetoothPrinter.isAvailable();
  } catch {
    return { available: false, enabled: undefined };
  }
}

export async function openBluetoothSettings() {
  await BluetoothPrinter.openBluetoothSettings();
}

export async function listPairedBluetoothPrinters() {
  const { devices } = await BluetoothPrinter.listPaired();
  return devices ?? [];
}

export async function getDefaultBluetoothPrinter(): Promise<DefaultPrinter> {
  try {
    return await BluetoothPrinter.getDefaultPrinter();
  } catch {
    return { configured: false };
  }
}

export async function setDefaultBluetoothPrinter(printer: PairedPrinter) {
  await BluetoothPrinter.setDefaultPrinter(printer);
}

export async function clearDefaultBluetoothPrinter() {
  await BluetoothPrinter.clearDefaultPrinter();
}

/** Imprime directement sur l'imprimante Bluetooth par defaut, sans boite de dialogue. */
export async function printTicketOverBluetooth(html: string, widthDots = 576) {
  return BluetoothPrinter.printTicket({ html, widthDots });
}

"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import Link from "next/link";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { getReceiptPrintSettings, openThermalDemoPreview } from "@/lib/print";
import {
  clearDefaultBluetoothPrinter,
  getDefaultBluetoothPrinter,
  isBluetoothPrintSupported,
  listPairedBluetoothPrinters,
  openBluetoothSettings,
  printTicketOverBluetooth,
  setDefaultBluetoothPrinter,
  type DefaultPrinter,
  type PairedPrinter
} from "@/lib/native-bluetooth-print";


type PosForm = {
  allowDiscount: boolean;
  requireCustomer: boolean;
  autoPrintReceipt: boolean;
  openCashDrawer: boolean;
};

type ReceiptPreviewWidth = "58" | "72" | "80";

export default function PosSettingsPage() {
  const [form, setForm] = useState<PosForm>({ allowDiscount: true, requireCustomer: false, autoPrintReceipt: false, openCashDrawer: false });
  const [receiptWidth, setReceiptWidth] = useState<ReceiptPreviewWidth>("80");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState<{ available: boolean; enabled?: boolean }>({ available: false });
  const [pairedPrinters, setPairedPrinters] = useState<PairedPrinter[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<DefaultPrinter>({ configured: false });
  const [bluetoothMsg, setBluetoothMsg] = useState("");
  const [bluetoothLoading, setBluetoothLoading] = useState(false);
  const [bluetoothTestPrinting, setBluetoothTestPrinting] = useState(false);

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/settings/pos`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setForm(toPosForm(data)));
    void getReceiptPrintSettings().then((settings) => setReceiptWidth(settings.width)).catch(() => undefined);
    void isBluetoothPrintSupported().then((status) => {
      setBluetoothStatus(status);
      if (status.available) void getDefaultBluetoothPrinter().then(setDefaultPrinter);
    });
  }, []);

  async function refreshPairedPrinters() {
    setBluetoothMsg("");
    setBluetoothLoading(true);
    try {
      const status = await isBluetoothPrintSupported();
      setBluetoothStatus(status);
      const devices = await listPairedBluetoothPrinters();
      setBluetoothStatus({ available: true, enabled: true });
      setPairedPrinters(devices);
      if (devices.length === 0) setBluetoothMsg("Aucun appareil Bluetooth appairé. Associez d'abord l'imprimante dans les réglages Bluetooth d'Android.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code.includes("BLUETOOTH_DISABLED")) {
        setBluetoothStatus({ available: true, enabled: false });
        setPairedPrinters([]);
        setBluetoothMsg("Bluetooth est désactivé. Activez-le dans les réglages Android, puis revenez ici.");
      } else if (code.includes("BLUETOOTH_PERMISSION_DENIED")) {
        setBluetoothMsg("Autorisation Bluetooth refusée. Autorisez VTA POS dans les réglages Android puis réessayez.");
      } else {
        setBluetoothMsg("Impossible de lister les appareils Bluetooth. Vérifiez que le Bluetooth est activé et l'autorisation accordée.");
      }
    } finally {
      setBluetoothLoading(false);
    }
  }

  async function configureBluetooth() {
    setBluetoothMsg("");
    try {
      await openBluetoothSettings();
    } catch {
      setBluetoothMsg("Impossible d’ouvrir les réglages Bluetooth sur cet appareil.");
    }
  }

  async function selectPrinter(printer: PairedPrinter) {
    await setDefaultBluetoothPrinter(printer);
    setDefaultPrinter({ configured: true, address: printer.address, name: printer.name });
    setBluetoothMsg(`"${printer.name || printer.address}" définie comme imprimante par défaut.`);
  }

  async function removeDefaultPrinter() {
    await clearDefaultBluetoothPrinter();
    setDefaultPrinter({ configured: false });
    setBluetoothMsg("Imprimante Bluetooth par défaut retirée.");
  }

  async function testBluetoothPrint() {
    if (bluetoothTestPrinting) return;
    setBluetoothMsg("");
    setBluetoothTestPrinting(true);
    try {
      const widthDots = receiptWidth === "58" ? 384 : 576;
      const contentWidthMm = receiptWidth === "58" ? 58 : 72;
      await printTicketOverBluetooth(buildBluetoothTestTicketHtml(contentWidthMm), widthDots);
      setBluetoothMsg("Ticket de test envoyé à l'imprimante.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "CONNECTION_FAILED") {
        setBluetoothMsg("Connexion Bluetooth impossible. Vérifiez que l'imprimante est allumée, à portée, et non connectée à un autre appareil.");
      } else if (code === "RENDER_FAILED") {
        setBluetoothMsg("Impossible de préparer le ticket à imprimer. Réessayez.");
      } else {
        setBluetoothMsg("Impression impossible. Vérifiez que l'imprimante est allumée et à portée.");
      }
    } finally {
      setBluetoothTestPrinting(false);
    }
  }

  function update(key: keyof PosForm, value: boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setMsg("");
    setSaving(true);
    try {
      const response = await fetchWithAuth(`${apiUrl}/settings/pos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPosForm(form)) });
      if (!response.ok) {
        setMsg("Sauvegarde impossible. Vérifiez les champs puis réessayez.");
        return;
      }
      setForm(toPosForm(await response.json()));
      setMsg("Paramètres enregistrés.");
    } catch {
      setMsg("Sauvegarde impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSaving(false);
    }
  }

  function previewTicket() {
    try {
      openThermalDemoPreview(receiptWidth);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Aperçu du ticket impossible.");
    }
  }

  return (
    <div className="space-y-5">
      <Header />
      <form onSubmit={submit} className="space-y-3 rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <Toggle label="Autoriser remise" checked={form.allowDiscount} onChange={(value) => update("allowDiscount", value)} />
        <Toggle label="Client obligatoire" checked={form.requireCustomer} onChange={(value) => update("requireCustomer", value)} />
        <Toggle label="Imprimer automatiquement après vente" checked={form.autoPrintReceipt} onChange={(value) => update("autoPrintReceipt", value)} />
        <Toggle label="Ouvrir tiroir-caisse préparé" checked={form.openCashDrawer} onChange={(value) => update("openCashDrawer", value)} />
        <div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700">
          <p className="text-sm font-semibold">Test imprimante thermique</p>
          <p className="mt-1 text-sm text-slate-500">Format actuel : {receiptWidth} mm. Le bouton ouvre un ticket de test sans créer de vente.</p>
          <button type="button" onClick={previewTicket} className="mt-3 rounded-md border px-4 py-2 text-sm font-semibold">Aperçu du ticket</button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <button disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Enregistrement..." : "Sauvegarder"}</button>
          {msg ? <p className="text-sm text-slate-500">{msg}</p> : null}
        </div>
      </form>

      {bluetoothStatus.available ? (
        <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold">Imprimante Bluetooth (impression directe, sans boîte de dialogue)</p>
          <p className="mt-1 text-sm text-slate-500">
            Appuyez sur « Configurer Bluetooth » pour associer l&apos;imprimante dans Android, revenez dans VTA POS, puis choisissez-la une seule fois. Les tickets s&apos;imprimeront ensuite automatiquement dessus.
          </p>

          {bluetoothStatus.enabled === false ? <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Bluetooth est actuellement désactivé.</p> : null}

          <button type="button" onClick={() => void configureBluetooth()} className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Configurer Bluetooth
          </button>

          {defaultPrinter.configured ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950">
              <span className="font-semibold text-emerald-800 dark:text-emerald-200">Imprimante par défaut : {defaultPrinter.name || defaultPrinter.address}</span>
              <button type="button" onClick={() => void removeDefaultPrinter()} className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">Retirer</button>
              <button type="button" onClick={() => void testBluetoothPrint()} disabled={bluetoothTestPrinting} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{bluetoothTestPrinting ? "Impression..." : "Imprimer un ticket de test"}</button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Aucune imprimante Bluetooth configurée pour l&apos;instant.</p>
          )}

          <button type="button" onClick={() => void refreshPairedPrinters()} disabled={bluetoothLoading} className="ml-0 mt-3 rounded-md border px-4 py-2 text-sm font-semibold sm:ml-2 sm:mt-4 disabled:cursor-not-allowed disabled:opacity-60">
            {bluetoothLoading ? "Recherche..." : "Voir les appareils Bluetooth appairés"}
          </button>

          {pairedPrinters.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {pairedPrinters.map((printer) => (
                <li key={printer.address} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm dark:border-slate-800">
                  <span>{printer.name || "Appareil sans nom"} <span className="text-slate-500">({printer.address})</span></span>
                  <button type="button" onClick={() => void selectPrinter(printer)} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">Définir par défaut</button>
                </li>
              ))}
            </ul>
          ) : null}

          {bluetoothMsg ? <p className="mt-3 text-sm text-slate-500">{bluetoothMsg}</p> : null}
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold">Impression Bluetooth directe indisponible</p>
          <p className="mt-1 text-sm text-slate-500">Cette fonction apparaît uniquement dans l&apos;application Android VTA POS sur un appareil équipé de Bluetooth. L&apos;impression système/PDF reste disponible.</p>
        </div>
      )}
    </div>
  );
}

function buildBluetoothTestTicketHtml(contentWidthMm: number) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { width: ${contentWidthMm}mm; margin: 0 auto; padding: 2mm; font-family: Consolas, "Courier New", monospace; font-size: 13px; font-weight: 700; }
    .center { text-align: center; } .line { border-top: 1px dashed #000; margin: 6px 0; }
  </style></head><body>
    <div class="center">TEST IMPRESSION BLUETOOTH</div>
    <div class="line"></div>
    <div>Si vous lisez ceci sur le papier,</div>
    <div>la connexion Bluetooth fonctionne.</div>
    <div class="line"></div>
  </body></html>`;
}

function toPosForm(data: Partial<PosForm>): PosForm {
  return {
    allowDiscount: data.allowDiscount !== false,
    requireCustomer: Boolean(data.requireCustomer),
    autoPrintReceipt: Boolean(data.autoPrintReceipt),
    openCashDrawer: Boolean(data.openCashDrawer)
  };
}

function Header() {
  return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Paramètres</p><h1 className="text-2xl font-bold">Impression</h1><div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/settings/company" className="rounded-md border px-3 py-2 text-sm">Entreprise</Link><Link href="/dashboard/settings/pos" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">Impression</Link><Link href="/dashboard/settings/invoicing" className="rounded-md border px-3 py-2 text-sm">Facturation</Link><Link href="/dashboard/settings/subscription" className="rounded-md border px-3 py-2 text-sm">Abonnement</Link><Link href="/dashboard/settings/emails" className="rounded-md border px-3 py-2 text-sm">Emails</Link></div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 rounded-md border p-3 dark:border-slate-800"><span className="font-medium">{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={(event)=>onChange(event.target.checked)} /></label>;
}



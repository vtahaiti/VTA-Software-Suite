"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { IosPageHeading } from "@/components/ios-page-heading";
import Link from "next/link";
import { bluetoothPrintError, buildBluetoothTestTicketHtml, receiptPrintOptions } from "@/lib/receipt-print-options";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { getReceiptPrintSettings, openThermalDemoPreview } from "@/lib/print";
import {
  clearDefaultBluetoothPrinter,
  getDefaultBluetoothPrinter,
  isBluetoothPrintSupported,
  listPairedBluetoothPrinters,
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
  const [loaded, setLoaded] = useState(false);
  const waitingForSettings = process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" && !loaded;
  const [testWidth, setTestWidth] = useState<"58" | "80">("80");
  const [nativePrinting, setNativePrinting] = useState(false);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<PairedPrinter[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<DefaultPrinter>({ configured: false });
  const [bluetoothMsg, setBluetoothMsg] = useState("");
  const [bluetoothLoading, setBluetoothLoading] = useState(false);
  const [bluetoothTestPrinting, setBluetoothTestPrinting] = useState(false);

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/settings/pos`)
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { setForm(toPosForm(data)); setLoaded(true); }).catch(() => setMsg("Chargement des paramètres impossible. Reconnectez-vous puis rouvrez cette page."));
    void getReceiptPrintSettings().then((settings) => setReceiptWidth(settings.width)).catch(() => undefined);
    void import("@capacitor/core").then(({ Capacitor }) => setNativePrinting(Capacitor.isNativePlatform()));
    void isBluetoothPrintSupported().then((supported) => {
      setBluetoothSupported(supported);
      if (supported) void getDefaultBluetoothPrinter().then(setDefaultPrinter);
    });
  }, []);

  async function refreshPairedPrinters() {
    setBluetoothMsg("");
    setBluetoothLoading(true);
    try {
      const devices = await listPairedBluetoothPrinters();
      setPairedPrinters(devices);
      if (devices.length === 0) setBluetoothMsg("Aucun appareil détecté. Sur iPhone, allumez une imprimante BLE compatible et relancez la recherche.");
    } catch {
      setBluetoothMsg("Impossible de lister les appareils Bluetooth. Vérifiez que le Bluetooth est activé et l'autorisation accordée.");
    } finally {
      setBluetoothLoading(false);
    }
  }

  async function selectPrinter(printer: PairedPrinter) {
    try {
      await setDefaultBluetoothPrinter(printer);
      setDefaultPrinter({ configured: true, address: printer.address, name: printer.name });
      setBluetoothMsg(`"${printer.name || printer.address}" définie comme imprimante par défaut. Imprimez un ticket de test pour confirmer la compatibilité.`);
    } catch (error) { setBluetoothMsg(bluetoothPrintError(error)); }
  }

  async function removeDefaultPrinter() {
    try {
      await clearDefaultBluetoothPrinter();
      setDefaultPrinter({ configured: false });
      setBluetoothMsg("Imprimante Bluetooth par défaut retirée.");
    } catch (error) { setBluetoothMsg(bluetoothPrintError(error)); }
  }

  async function testBluetoothPrint() {
    if (bluetoothTestPrinting) return;
    setBluetoothMsg("");
    setBluetoothTestPrinting(true);
    try {
      const { widthDots } = receiptPrintOptions(testWidth);
      await printTicketOverBluetooth(buildBluetoothTestTicketHtml(testWidth), widthDots, defaultPrinter.address);
      setBluetoothMsg("Ticket de test envoyé. Confirmez sur le papier que les accents, les montants et la coupe sont corrects.");
    } catch (error) {
      setBluetoothMsg(bluetoothPrintError(error));
    } finally {
      setBluetoothTestPrinting(false);
    }
  }

  function update(key: keyof PosForm, value: boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || waitingForSettings) return;
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
          <button disabled={saving || waitingForSettings} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Enregistrement..." : "Sauvegarder"}</button>
          {msg ? <p className="text-sm text-slate-500">{msg}</p> : null}
        </div>
      </form>

      {nativePrinting ? (
        <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold">Imprimante Bluetooth (impression directe, sans boîte de dialogue)</p>
          <p className="mt-1 text-sm text-slate-500">
            Sur iPhone, recherchez une imprimante BLE ESC/POS compatible, puis sélectionnez-la ici. Sur Android, associez-la d’abord dans les réglages Bluetooth. Le modèle 2Connect POS80-01 V10 doit être confirmé par un ticket de test.
          </p>

          {!bluetoothSupported ? <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <p>Bluetooth n’est pas disponible. Vérifiez l’autorisation de VTA POS dans les réglages du téléphone et la version de l’app installée.</p>
            <button type="button" onClick={() => { void isBluetoothPrintSupported().then(setBluetoothSupported); }} className="mt-2 rounded-md border px-3 py-2 font-semibold">Vérifier Bluetooth</button>
          </div> : null}
          <label className="mt-4 block text-sm font-semibold">Papier du ticket de test
            <select value={testWidth} onChange={event => setTestWidth(event.target.value === "58" ? "58" : "80")} disabled={bluetoothTestPrinting} className="ml-3 rounded-md border bg-white px-3 py-2 text-slate-900">
              <option value="80">80 mm · 2Connect POS80-01 V10</option><option value="58">58 mm</option>
            </select>
          </label>
          {defaultPrinter.configured ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950">
              <span className="font-semibold text-emerald-800 dark:text-emerald-200">Imprimante par défaut : {defaultPrinter.name || defaultPrinter.address}</span>
              <button type="button" onClick={() => void removeDefaultPrinter()} disabled={bluetoothTestPrinting} className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">Retirer</button>
              <button type="button" onClick={() => void testBluetoothPrint()} disabled={!bluetoothSupported || bluetoothTestPrinting} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{bluetoothTestPrinting ? "Impression..." : "Imprimer un ticket de test"}</button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Aucune imprimante Bluetooth configurée pour l&apos;instant.</p>
          )}

          <button type="button" onClick={() => void refreshPairedPrinters()} disabled={!bluetoothSupported || bluetoothLoading || bluetoothTestPrinting} className="mt-4 rounded-md border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            {bluetoothLoading ? "Recherche..." : "Rechercher les imprimantes Bluetooth"}
          </button>

          {pairedPrinters.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {pairedPrinters.map((printer) => (
                <li key={printer.address} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm dark:border-slate-800">
                  <span>{printer.name || "Appareil sans nom"} <span className="text-slate-500">({printer.address})</span></span>
                  <button type="button" onClick={() => void selectPrinter(printer)} disabled={bluetoothTestPrinting || bluetoothLoading} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">Définir par défaut</button>
                </li>
              ))}
            </ul>
          ) : null}

          {bluetoothMsg ? <p className="mt-3 text-sm text-slate-500">{bluetoothMsg}</p> : null}
        </div>
      ) : null}
    </div>
  );
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
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1") return <IosPageHeading title="Impression" />;
  return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Paramètres</p><h1 className="text-2xl font-bold">Impression</h1><div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/settings/company" className="rounded-md border px-3 py-2 text-sm">Entreprise</Link><Link href="/dashboard/settings/pos" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">Impression</Link><Link href="/dashboard/settings/invoicing" className="rounded-md border px-3 py-2 text-sm">Facturation</Link><Link href="/dashboard/settings/subscription" className="rounded-md border px-3 py-2 text-sm">Abonnement</Link><Link href="/dashboard/settings/emails" className="rounded-md border px-3 py-2 text-sm">Emails</Link></div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 rounded-md border p-3 dark:border-slate-800"><span className="font-medium">{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={(event)=>onChange(event.target.checked)} /></label>;
}



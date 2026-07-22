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
  printTicketOverBluetooth,
  setDefaultBluetoothPrinter,
  type DefaultPrinter,
  type PairedPrinter
} from "@/lib/native-bluetooth-print";


type PosForm = {
  allowNegativeStock: boolean;
  allowDiscount: boolean;
  requireCustomer: boolean;
  autoPrintReceipt: boolean;
  openCashDrawer: boolean;
};

type ReceiptPreviewWidth = "58" | "72" | "80";

export default function PosSettingsPage() {
  const [form, setForm] = useState<PosForm>({ allowNegativeStock: false, allowDiscount: true, requireCustomer: false, autoPrintReceipt: false, openCashDrawer: false });
  const [receiptWidth, setReceiptWidth] = useState<ReceiptPreviewWidth>("80");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<PairedPrinter[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<DefaultPrinter>({ configured: false });
  const [bluetoothMsg, setBluetoothMsg] = useState("");
  const [bluetoothLoading, setBluetoothLoading] = useState(false);

  useEffect(() => {
    fetchWithAuth(`${apiUrl}/settings/pos`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setForm(toPosForm(data)));
    void getReceiptPrintSettings().then((settings) => setReceiptWidth(settings.width)).catch(() => undefined);
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
      if (devices.length === 0) setBluetoothMsg("Aucun appareil Bluetooth appairé. Associez d'abord l'imprimante dans les réglages Bluetooth d'Android.");
    } catch {
      setBluetoothMsg("Impossible de lister les appareils Bluetooth. Vérifiez que le Bluetooth est activé et l'autorisation accordée.");
    } finally {
      setBluetoothLoading(false);
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
    setBluetoothMsg("");
    try {
      await printTicketOverBluetooth(buildBluetoothTestTicketHtml());
      setBluetoothMsg("Ticket de test envoyé à l'imprimante.");
    } catch {
      setBluetoothMsg("Impression impossible. Vérifiez que l'imprimante est allumée et à portée.");
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
        <Toggle label="Autoriser vente sans stock" checked={form.allowNegativeStock} onChange={(value) => update("allowNegativeStock", value)} />
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

      {bluetoothSupported ? (
        <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold">Imprimante Bluetooth (impression directe, sans boîte de dialogue)</p>
          <p className="mt-1 text-sm text-slate-500">
            Associez d&apos;abord l&apos;imprimante dans les réglages Bluetooth de la tablette, puis choisissez-la ici une seule fois. Les tickets s&apos;imprimeront ensuite automatiquement dessus, comme sur un système de caisse classique.
          </p>

          {defaultPrinter.configured ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950">
              <span className="font-semibold text-emerald-800 dark:text-emerald-200">Imprimante par défaut : {defaultPrinter.name || defaultPrinter.address}</span>
              <button type="button" onClick={() => void removeDefaultPrinter()} className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">Retirer</button>
              <button type="button" onClick={() => void testBluetoothPrint()} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Imprimer un ticket de test</button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Aucune imprimante Bluetooth configurée pour l&apos;instant.</p>
          )}

          <button type="button" onClick={() => void refreshPairedPrinters()} disabled={bluetoothLoading} className="mt-4 rounded-md border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
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
      ) : null}
    </div>
  );
}

function buildBluetoothTestTicketHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Consolas, "Courier New", monospace; font-size: 13px; font-weight: 700; margin: 0; padding: 6px; }
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
    allowNegativeStock: Boolean(data.allowNegativeStock),
    allowDiscount: data.allowDiscount !== false,
    requireCustomer: Boolean(data.requireCustomer),
    autoPrintReceipt: Boolean(data.autoPrintReceipt),
    openCashDrawer: Boolean(data.openCashDrawer)
  };
}

function Header() {
  return <div className="rounded-lg border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Paramètres</p><h1 className="text-2xl font-bold">Paramètres POS</h1><div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/settings/company" className="rounded-md border px-3 py-2 text-sm">Entreprise</Link><Link href="/dashboard/settings/pos" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">POS</Link><Link href="/dashboard/settings/invoicing" className="rounded-md border px-3 py-2 text-sm">Facturation</Link><Link href="/dashboard/settings/subscription" className="rounded-md border px-3 py-2 text-sm">Abonnement</Link><Link href="/dashboard/settings/emails" className="rounded-md border px-3 py-2 text-sm">Emails</Link></div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 rounded-md border p-3 dark:border-slate-800"><span className="font-medium">{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={(event)=>onChange(event.target.checked)} /></label>;
}



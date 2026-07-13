"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { isNativePrintAvailable, printHtmlNative, sharePdfNative } from "@/lib/native-print";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type ReceiptWidth = "58" | "80";

export default function PosTicketPrintPage() {
  const searchParams = useSearchParams();
  const path = searchParams.get("path");
  const isDemo = searchParams.get("demo") === "1";
  const autoPrint = searchParams.get("autoPrint") === "1";
  const width: ReceiptWidth = searchParams.get("width") === "58" ? "58" : "80";
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState("Préparation du ticket...");
  const [error, setError] = useState("");
  const [nativePrint, setNativePrint] = useState(false);
  const [printedAutomatically, setPrintedAutomatically] = useState(false);
  const frameWidth = width === "58" ? "58mm" : "80mm";
  const demoHtml = useMemo(() => buildSafeDemoTicket(width), [width]);

  useEffect(() => {
    void isNativePrintAvailable().then(setNativePrint).catch(() => setNativePrint(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTicket() {
      setError("");
      setStatus("Chargement du ticket...");
      if (isDemo) {
        setHtml(demoHtml);
        setStatus("Aperçu prêt.");
        return;
      }
      if (!path) {
        setError("Aucun ticket à afficher.");
        setStatus("");
        return;
      }
      try {
        const response = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        if (!response.ok) throw new Error(await readError(response));
        const text = await response.text();
        if (!cancelled) {
          setHtml(text);
          setStatus("Aperçu prêt.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger le ticket.");
          setStatus("");
        }
      }
    }
    void loadTicket();
    return () => { cancelled = true; };
  }, [demoHtml, isDemo, path]);

  const printFrame = useCallback(async () => {
    if (nativePrint) {
      if (!html) {
        setError("L'aperçu n'est pas encore prêt. Réessayez dans quelques secondes.");
        return;
      }
      try {
        setStatus("Ouverture de l'impression Android...");
        await printHtmlNative({ html, title: `Ticket VTA Commerce ${width} mm`, format: width });
        setStatus("Dialogue d'impression Android ouvert.");
      } catch {
        setError("Impossible d'ouvrir l'impression Android. Essayez le partage PDF.");
      }
      return;
    }

    const frame = iframeRef.current;
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    if (!frame || !win || !doc) {
      setError("L'aperçu n'est pas encore prêt. Réessayez dans quelques secondes.");
      return;
    }
    try {
      setStatus("Préparation de l'impression...");
      await waitForPrintableDocument(doc);
      win.focus();
      win.print();
      setStatus("Dialogue d'impression ouvert.");
    } catch {
      setError("Impossible d'ouvrir l'impression. Vous pouvez réessayer avec le bouton Imprimer.");
    }
  }, [html, nativePrint, width]);

  const sharePdf = useCallback(async () => {
    if (!html) {
      setError("L'aperçu n'est pas encore prêt. Réessayez dans quelques secondes.");
      return;
    }
    try {
      setStatus("Préparation du PDF...");
      await sharePdfNative({
        html,
        title: `Ticket VTA Commerce ${width} mm`,
        fileName: `ticket-vta-${width}mm.pdf`,
        format: width
      });
      setStatus("Partage PDF ouvert.");
    } catch {
      setError("Impossible de préparer le partage PDF.");
    }
  }, [html, width]);

  useEffect(() => {
    if (!autoPrint || printedAutomatically || !html || error) return;
    const timer = window.setTimeout(() => {
      setPrintedAutomatically(true);
      void printFrame();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [autoPrint, error, html, printFrame, printedAutomatically]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page { margin: 0; }
          html, body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-shell { margin: 0 !important; padding: 0 !important; background: white !important; }
          .ticket-frame { border: 0 !important; box-shadow: none !important; display: block !important; margin: 0 !important; }
        }
      `}</style>
      <section className="no-print mx-auto mb-4 flex max-w-3xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Ticket thermique {width} mm</p>
          <h1 className="text-xl font-black">Aperçu du ticket</h1>
          <p className="text-sm text-slate-500">{status || error || "Vérifiez le ticket avant impression."}</p>
          {error ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/pos" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">Retour au POS</Link>
          {nativePrint ? <button onClick={() => void sharePdf()} disabled={!html || Boolean(error)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Partager en PDF</button> : null}
          <button onClick={() => void printFrame()} disabled={!html || Boolean(error)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Imprimer</button>
        </div>
      </section>
      <section className="print-shell mx-auto flex justify-center">
        {html ? (
          <iframe
            ref={iframeRef}
            title="Ticket POS"
            srcDoc={html}
            className="ticket-frame min-h-[720px] bg-white shadow-2xl"
            style={{ width: frameWidth }}
            onLoad={() => setStatus("Aperçu prêt.")}
          />
        ) : (
          <div className="no-print rounded-2xl bg-white p-8 text-sm text-slate-500 shadow-sm">Chargement du ticket...</div>
        )}
      </section>
      <section className="no-print mx-auto mt-4 max-w-3xl rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
        Impression prête. Vérifiez le format du papier dans le dialogue d’impression avant de valider.
      </section>
    </main>
  );
}

async function waitForPrintableDocument(doc: Document) {
  if (doc.fonts?.ready) await doc.fonts.ready;
  const images = Array.from(doc.images ?? []);
  await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  })));
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Impossible de charger le ticket.";
  } catch {
    return "Impossible de charger le ticket.";
  }
}

function buildSafeDemoTicket(width: ReceiptWidth) {
  const safePadding = width === "58" ? "2mm" : "3mm";
  const usefulWidth = width === "58" ? "54mm" : "74mm";
  const amountWidth = width === "58" ? "23mm" : "30mm";
  const fontSize = width === "58" ? "10px" : "11px";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aperçu ticket</title><style>
    @page { size: ${width}mm auto; margin: 0; }
    @media print { @page { size: ${width}mm auto; margin: 0; } html, body { width: ${width}mm; margin: 0; padding: 0; } .no-print { display: none !important; } }
    *, *::before, *::after { box-sizing: border-box; max-width: 100%; }
    html, body { width: ${width}mm; max-width: ${width}mm; margin: 0; padding: 0; background: #fff; overflow-x: hidden; }
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: ${fontSize}; color: #111; }
    .ticket { width: 100%; max-width: ${width}mm; padding: ${safePadding}; overflow: hidden; }
    .ticket-inner { width: 100%; max-width: ${usefulWidth}; margin: 0 auto; overflow: hidden; }
    .center { text-align: center; }
    .line { border-top: 1px dashed #111; margin: 7px 0; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, ${amountWidth}); column-gap: 2mm; align-items: start; padding: 2px 0; width: 100%; }
    .label { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    .amount { min-width: 0; justify-self: end; text-align: right; overflow-wrap: anywhere; word-break: break-word; font-variant-numeric: tabular-nums; }
    .name { font-weight: 700; overflow-wrap: anywhere; word-break: break-word; }
    .note { color: #555; font-size: 9px; overflow-wrap: anywhere; }
    .total { border-top: 1px solid #111; padding-top: 5px; font-size: 1.15em; font-weight: 900; }
  </style></head><body><div class="ticket"><div class="ticket-inner"><div class="center"><strong>MON ENTREPRISE</strong><br>Adresse principale<br>Tel: 0000-0000</div><div class="line"></div><div class="row"><span class="label">Ticket</span><strong class="amount">TEST-001</strong></div><div class="row"><span class="label">Date</span><strong class="amount">${new Date().toLocaleString("fr-HT")}</strong></div><div class="row"><span class="label">Caissier</span><strong class="amount">Test</strong></div><div class="line"></div><div class="row"><div class="label"><div class="name">Produit avec nom très long qui doit passer sur plusieurs lignes sans couper le montant à droite</div><div class="note">123 x 1 000 000,00 G</div></div><strong class="amount">123 000 000,00 G</strong></div><div class="row"><div class="label"><div class="name">Service personnalisé</div><div class="note">2 x 100 000,00 USD</div></div><strong class="amount">200 000,00 USD</strong></div><div class="line"></div><div class="row"><span class="label">Sous-total</span><strong class="amount">123 200 000,00 G</strong></div><div class="row"><span class="label">Remise</span><strong class="amount">1 000,00 G</strong></div><div class="row"><span class="label">Taxe</span><strong class="amount">0,00 G</strong></div><div class="row total"><span class="label">Total</span><strong class="amount">123 199 000,00 G</strong></div><div class="row"><span class="label">Montant reçu</span><strong class="amount">100 000,00 G</strong></div><div class="row"><span class="label">Monnaie rendue</span><strong class="amount">25 000,00 G</strong></div><div class="row"><span class="label">Reste à payer</span><strong class="amount">23 199 000,00 G</strong></div><div class="line"></div><div class="center"><strong>Signature autorisée : ______________________________</strong><br>Conservez ce ticket.</div></div></div></body></html>`;
}

function buildDemoTicket(width: ReceiptWidth) {
  const usefulWidth = width === "58" ? "58mm" : "80mm";
  const safePadding = width === "58" ? "2mm" : "3mm";
  const fontSize = width === "58" ? "10px" : "11px";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aperçu ticket</title><style>
    @page { size: ${width}mm auto; margin: 0; }
    @media print { @page { margin: 0; } html, body { margin: 0; padding: 0; } .no-print { display: none !important; } }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { width: ${usefulWidth}; margin: 0 auto; padding: ${safePadding}; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: ${fontSize}; color: #111; }
    .center { text-align: center; } .line { border-top: 1px dashed #111; margin: 7px 0; } .row { display: flex; justify-content: space-between; gap: 8px; } .name { font-weight: 700; overflow-wrap: anywhere; } .total { border-top: 1px solid #111; padding-top: 5px; font-size: 1.15em; font-weight: 900; }
  </style></head><body><div class="center"><strong>MON ENTREPRISE</strong><br>Adresse principale<br>Tel: 0000-0000</div><div class="line"></div><div class="row"><span>Ticket</span><strong>TEST-001</strong></div><div class="row"><span>Date</span><strong>${new Date().toLocaleString("fr-HT")}</strong></div><div class="row"><span>Caissier</span><strong>Test</strong></div><div class="line"></div><div><div class="name">Produit avec nom très long qui doit passer sur plusieurs lignes</div><div class="row"><span>2 x 125,00 G</span><strong>250,00 G</strong></div></div><div><div class="name">Service personnalisé</div><div class="row"><span>1 x 500,00 G</span><strong>500,00 G</strong></div></div><div class="line"></div><div class="row"><span>Sous-total</span><strong>750,00 G</strong></div><div class="row"><span>Remise</span><strong>0,00 G</strong></div><div class="row"><span>Taxe</span><strong>0,00 G</strong></div><div class="row total"><span>Total</span><strong>750,00 G</strong></div><div class="row"><span>Espèces</span><strong>750,00 G</strong></div><div class="row"><span>Montant reçu</span><strong>1 000,00 G</strong></div><div class="row"><span>Monnaie rendue</span><strong>250,00 G</strong></div><div class="line"></div><div class="center"><strong>Merci pour votre achat</strong><br>Conservez ce ticket.</div></body></html>`;
}

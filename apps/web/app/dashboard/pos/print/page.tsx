"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PosTicketPrintPage() {
  const searchParams = useSearchParams();
  const companyName = searchParams.get("companyName") || "Mon entreprise";
  const cashierName = searchParams.get("cashierName") || "Utilisateur";
  const receiptNumber = searchParams.get("receiptNumber") || "Ticket";
  const content = searchParams.get("content") || "Ticket de vente";
  const logoUrl = searchParams.get("logoUrl");
  const phone = searchParams.get("phone") || "";
  const address = searchParams.get("address") || "";
  const email = searchParams.get("email") || "";
  const taxNumber = searchParams.get("taxNumber") || "";
  const width = searchParams.get("width") === "58" ? "58" : "80";
  const ticketWidth = width === "58" ? "58mm" : "80mm";
  const printableWidth = width === "58" ? "52mm" : "74mm";
  const parsedTicket = parseTicketContent(content);
  const initials = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ME";

  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 print:bg-white print:p-0">
      <style jsx global>{`
        @page {
          size: ${ticketWidth} auto;
          margin: 3mm;
        }
        @media print {
          html,
          body {
            width: ${ticketWidth};
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .thermal-ticket {
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
            width: ${printableWidth} !important;
          }
          .screen-toolbar {
            display: none !important;
          }
        }
      `}</style>
      <div className="screen-toolbar mx-auto mb-4 flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <Link href="/dashboard/pos" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">
          Retour au POS
        </Link>
        <button onClick={() => window.print()} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
          Imprimer
        </button>
      </div>
      <div className="thermal-ticket mx-auto max-w-full overflow-hidden rounded-[22px] border border-slate-200 bg-white text-[11px] leading-tight shadow-2xl print:rounded-none" style={{ width: printableWidth }}>
        <div className="mb-3 hidden print:hidden">
          <Link href="/dashboard/pos" className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
            Retour au POS
          </Link>
        </div>
        <section className="px-3 py-4 print:px-0 print:py-0">
          <div className="text-center">
            <div className="mx-auto mb-2 grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-slate-300 bg-white text-base font-black shadow-sm print:h-12 print:w-12">
              {logoUrl ? <img src={logoUrl} alt={`Logo ${companyName}`} className="h-full w-full object-contain p-2 print:p-1" /> : initials}
            </div>
            <strong className="block text-[14px] uppercase tracking-wide print:text-[12px]">{companyName}</strong>
            <br />
            <div className="text-[10px] text-slate-600">
              {address ? <><span>{address}</span><br /></> : null}
              {phone ? <><span>Tel : {phone}</span><br /></> : null}
              {email ? <><span>{email}</span><br /></> : null}
              {taxNumber ? <><span>NIF : {taxNumber}</span><br /></> : null}
            </div>
          </div>
          <DashedLine />
          <div className="grid gap-1 text-[10px]">
            <MetaLine label="Ticket" value={receiptNumber} />
            <MetaLine label="Date" value={new Date().toLocaleString("fr-HT")} />
            <MetaLine label="Caissier" value={cashierName} />
          </div>
          <DashedLine />
          <div className="space-y-2">
            {parsedTicket.items.length ? parsedTicket.items.map((line, index) => (
              <div key={`${line}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 text-[11px]">
                <span className="break-words font-semibold">{line}</span>
              </div>
            )) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-tight">{content}</pre>
            )}
          </div>
          {parsedTicket.totals.length ? (
            <>
              <DashedLine />
              <div className="space-y-1">
                {parsedTicket.totals.map((row) => (
                  <div key={row.label} className={`flex justify-between gap-3 ${row.important ? "text-[14px] font-black" : "text-[11px] font-semibold"}`}>
                    <span>{row.label}</span>
                    <span className="text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <DashedLine />
          <div className="text-center">
            <p className="text-[12px] font-black">Merci pour votre achat</p>
            <p className="mt-1 text-[9px] text-slate-500">Conservez ce ticket comme preuve de paiement.</p>
            <div className="mx-auto mt-3 grid h-12 w-12 place-items-center rounded border border-dashed border-slate-500 text-[9px] text-slate-500">QR</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashedLine() {
  return <div className="my-3 border-t border-dashed border-slate-500" />;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-slate-500">{label}</span><strong className="text-right">{value}</strong></div>;
}

function parseTicketContent(content: string) {
  const itemLines: string[] = [];
  const totals: Array<{ label: string; value: string; important?: boolean }> = [];
  const totalLabels = new Set(["Sous-total", "Total", "Paye", "Payé", "Montant paye", "Montant payé", "Monnaie", "Monnaie rendue", "Balance"]);
  for (const rawLine of content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    if (rawLine.toLowerCase().startsWith("ticket") || rawLine.toLowerCase().startsWith("vente ")) continue;
    const match = rawLine.match(/^([^:]+):\s*(.+)$/);
    if (match && totalLabels.has(match[1])) {
      totals.push({ label: match[1].replace("Paye", "Payé"), value: match[2], important: match[1] === "Total" });
      continue;
    }
    itemLines.push(rawLine);
  }
  return { items: itemLines, totals };
}

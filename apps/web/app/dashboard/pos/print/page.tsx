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
    <main className="min-h-screen bg-white p-4 text-slate-950 print:p-0">
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
          }
        }
      `}</style>
      <div className="thermal-ticket mx-auto max-w-full rounded-xl bg-white text-[11px] leading-tight shadow-sm print:rounded-none" style={{ width: printableWidth }}>
        <div className="mb-3 print:hidden">
          <Link href="/dashboard/pos" className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
            Retour au POS
          </Link>
        </div>
        <section className="px-1 py-2">
          <div className="text-center">
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-slate-900 bg-white text-sm font-black">
              {logoUrl ? <img src={logoUrl} alt={`Logo ${companyName}`} className="h-full w-full object-contain p-1" /> : initials}
            </div>
            <strong className="text-[13px] uppercase">{companyName}</strong>
            <br />
            {address ? <><span>{address}</span><br /></> : null}
            {phone ? <><span>Tel : {phone}</span><br /></> : null}
            {email ? <><span>{email}</span><br /></> : null}
            {taxNumber ? <><span>NIF : {taxNumber}</span><br /></> : null}
            <span>Caissier : {cashierName}</span>
            <br />
            <span>{receiptNumber}</span>
          </div>
          <div className="my-2 border-t border-dashed border-slate-900" />
          <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-tight">{content}</pre>
          <div className="my-2 border-t border-dashed border-slate-900" />
          <p className="text-center font-semibold">Merci pour votre achat</p>
        </section>
      </div>
    </main>
  );
}

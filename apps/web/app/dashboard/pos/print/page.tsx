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

  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-white p-4 text-slate-950 print:p-0">
      <div className="mx-auto w-[74mm] max-w-full text-[12px]">
        <div className="mb-3 print:hidden">
          <Link href="/dashboard/pos" className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
            Retour au POS
          </Link>
        </div>
        <section>
          <div className="text-center">
            <strong className="text-sm">{companyName}</strong>
            <br />
            <span>Caissier : {cashierName}</span>
            <br />
            <span>{receiptNumber}</span>
          </div>
          <div className="my-2 border-t border-dashed border-slate-900" />
          <pre className="whitespace-pre-wrap font-sans">{content}</pre>
          <div className="my-2 border-t border-dashed border-slate-900" />
          <p className="text-center font-semibold">Merci pour votre achat</p>
        </section>
      </div>
    </main>
  );
}

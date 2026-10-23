import { isEmbeddedLogo } from "@/lib/receipt-logo";
export function buildOfflineReceipt(input: {
  localId: string; company: string; logoDataUrl?: string | null; width: "58" | "72" | "80";
  createdAt: string; items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number; discount: number; tax: number; total: number; received: number;
}) {
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
  const money = (value: number) => Number(value).toFixed(2);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>@page{size:${input.width}mm auto;margin:2mm}body{font:11px -apple-system,Arial,sans-serif;margin:0;color:#000}h1{font-size:15px}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}td:last-child{text-align:right}.line{border-top:1px dashed #000;padding-top:5px}</style></head><body>
    ${isEmbeddedLogo(input.logoDataUrl) ? `<div class="receipt-logo" style="text-align:center"><img src="${escape(input.logoDataUrl)}" alt="Logo entreprise" style="max-width:28mm;max-height:18mm;object-fit:contain"/></div>` : ""}<h1>${escape(input.company)}</h1><p>Ticket local — en attente de synchronisation<br>${escape(input.localId)}<br>${escape(input.createdAt)}</p>
    <table>${input.items.map(item => `<tr><td>${escape(item.name)}<br>${item.quantity} × ${money(item.unitPrice)}</td><td>${money(item.total)}</td></tr>`).join("")}</table>
    <div class="line">Sous-total : ${money(input.subtotal)}<br>Remise : ${money(input.discount)}<br>Taxes : ${money(input.tax)}<br><strong>Total : ${money(input.total)}</strong><br>Reçu : ${money(input.received)}<br>Monnaie : ${money(Math.max(0, input.received - input.total))}</div>
    <p>Merci ! Conservez ce ticket local.</p></body></html>`;
}

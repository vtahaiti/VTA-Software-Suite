import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PdfService } from "./pdf.service";
import { summarizePayments } from "../common/payment-business-rules";

type PaperFormat = "a4" | "letter";
type ReceiptWidth = "58" | "80";
type BrandedTenant = { name: string; address?: string | null; phone?: string | null; email?: string | null; companyProfile?: { companyName?: string | null; name?: string | null; logoUrl?: string | null; phone?: string | null; email?: string | null; address?: string | null; taxNumber?: string | null } | null; logo?: { url?: string | null } | null };

@Injectable()
export class InvoicePrintService {
  constructor(private readonly prisma: PrismaService, private readonly pdf: PdfService) {}

  async renderReceipt(tenantId: string, saleId: string, width: ReceiptWidth = "80") {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { tenant: { include: { companyProfile: true, logo: true } }, customer: true, items: { include: { product: true } }, payments: true, receipt: true, cashSession: { include: { cashRegister: true } } }
    });
    if (!sale) throw new NotFoundException("Vente introuvable");
    const tenant = sale.tenant as BrandedTenant;
    const cashier = sale.createdById ? await this.prisma.user.findFirst({ where: { id: sale.createdById, tenantId }, select: { name: true } }) : null;
    const paymentSummary = summarizePayments(sale.total, sale.payments);
    const paid = paymentSummary.settledAmount;
    const received = paymentSummary.receivedAmount;
    const change = paymentSummary.changeAmount;
    const widthMm = width === "58" ? 58 : 80;
    const usefulWidth = width === "58" ? "58mm" : "80mm";
    const safePadding = width === "58" ? "2mm" : "3mm";
    const fontSize = width === "58" ? "10px" : "11px";
    return this.page(`Ticket ${sale.receipt?.number ?? sale.id}`, `
      <style>
        @page { size: ${widthMm}mm auto; margin: 0; }
        @media print {
          @page { margin: 0; }
          html, body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; }
        body { width: ${usefulWidth}; margin: 0 auto; padding: ${safePadding}; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: ${fontSize}; line-height: 1.25; color: #111827; }
        .ticket { width: 100%; overflow: hidden; }
        .center { text-align: center; }
        .logo { width: ${width === "58" ? "36px" : "44px"}; height: ${width === "58" ? "36px" : "44px"}; margin: 0 auto 5px; border: 1px solid #d1d5db; border-radius: 999px; display: grid; place-items: center; font-weight: 800; font-size: 12px; overflow: hidden; }
        .logo img { width: 100%; height: 100%; object-fit: contain; padding: 4px; filter: grayscale(1) contrast(1.15); }
        .company { display: block; font-size: ${width === "58" ? "11px" : "13px"}; letter-spacing: .2px; text-transform: uppercase; overflow-wrap: anywhere; }
        .muted { color: #4b5563; overflow-wrap: anywhere; }
        .line { border-top: 1px dashed #6b7280; margin: 7px 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        td { padding: 2px 0; vertical-align: top; }
        .right { text-align: right; }
        .meta td:first-child, .summary td:first-child { color: #4b5563; width: 42%; }
        .item-name { font-weight: 800; overflow-wrap: anywhere; word-break: break-word; }
        .item-note { color: #4b5563; font-size: 9px; overflow-wrap: anywhere; }
        .line-total { width: 34%; text-align: right; white-space: nowrap; }
        .total-row td { padding-top: 5px; font-size: ${width === "58" ? "12px" : "14px"}; font-weight: 900; border-top: 1px solid #111827; }
        .thanks { margin-top: 8px; font-weight: 800; text-align: center; }
        .legal { margin-top: 2px; text-align: center; font-size: 9px; color: #6b7280; }
      </style>
      <div class="ticket">
        <div class="center">
          <div class="logo">${this.logoContent(tenant)}</div>
          <strong class="company">${this.escape(this.companyName(tenant))}</strong><br/>
          ${this.companyAddress(tenant) ? `<span class="muted">${this.escape(this.companyAddress(tenant))}</span><br/>` : ""}
          ${this.companyPhone(tenant) ? `<span class="muted">Tel: ${this.escape(this.companyPhone(tenant))}</span><br/>` : ""}
          ${this.companyEmail(tenant) ? `<span class="muted">${this.escape(this.companyEmail(tenant))}</span><br/>` : ""}
          ${this.companyTax(tenant) ? `<span class="muted">NIF: ${this.escape(this.companyTax(tenant))}</span><br/>` : ""}
        </div>
        <div class="line"></div>
        <table class="meta"><tr><td>Ticket</td><td class="right">${this.escape(sale.receipt?.number ?? sale.id)}</td></tr><tr><td>Date</td><td class="right">${this.date(sale.createdAt)}</td></tr><tr><td>Caissier</td><td class="right">${this.escape(cashier?.name ?? sale.cashSession?.cashRegister?.name ?? "Caisse")}</td></tr><tr><td>Client</td><td class="right">${this.escape(sale.customer?.displayName ?? "Client comptoir")}</td></tr></table>
        <div class="line"></div>
        <table>${sale.items.map((item) => `<tr><td><div class="item-name">${this.escape(this.itemName(item))}</div>${item.productId ? "" : `<div class="item-note">Article personnalisé</div>`}<div class="item-note">${item.quantity} x ${this.money(item.unitPrice)}${Number(item.discount) > 0 ? ` - remise ${this.money(item.discount)}` : ""}</div></td><td class="line-total"><strong>${this.money(item.total)}</strong></td></tr>`).join("")}</table>
        <div class="line"></div>
        <table class="summary"><tr><td>Sous-total</td><td class="right">${this.money(sale.subtotal)}</td></tr>${Number(sale.discount) > 0 ? `<tr><td>Remise</td><td class="right">${this.money(sale.discount)}</td></tr>` : ""}${Number(sale.tax) > 0 ? `<tr><td>Taxes</td><td class="right">${this.money(sale.tax)}</td></tr>` : ""}<tr class="total-row"><td>Total</td><td class="right">${this.money(sale.total)}</td></tr><tr><td>Montant réglé</td><td class="right">${this.money(paid)}</td></tr><tr><td>Montant reçu</td><td class="right">${this.money(received)}</td></tr><tr><td>Monnaie rendue</td><td class="right">${this.money(change)}</td></tr></table>
        <div class="line"></div>
        <div class="thanks">Merci pour votre achat</div>
        <div class="legal">Conservez ce ticket comme preuve de paiement.</div>
      </div>
    `);
  }

  async renderInvoice(tenantId: string, invoiceId: string, format: PaperFormat = "letter") {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { tenant: { include: { companyProfile: true, logo: true } }, customer: true, items: { include: { product: true } }, payments: true }
    });
    if (!invoice) throw new NotFoundException("Facture introuvable");
    const tenant = invoice.tenant as BrandedTenant;
    const paymentSummary = summarizePayments(invoice.total, invoice.payments);
    const paid = paymentSummary.settledAmount;
    const received = paymentSummary.receivedAmount;
    const change = paymentSummary.changeAmount;
    const pageSize = format === "a4" ? "A4" : "Letter";
    return this.page(`Facture ${invoice.documentNumber}`, `
      <style>
        @page { size: ${pageSize}; margin: ${format === "a4" ? "12mm" : "12.7mm"}; }
        body { font-family: Arial, sans-serif; color: #111827; font-size: 12px; } .top { display: flex; justify-content: space-between; gap: 24px; } .logo { width: 64px; height: 64px; border: 1px solid #111827; border-radius: 10px; display: grid; place-items: center; font-weight: 700; margin-bottom: 8px; overflow: hidden; } .logo img { width: 100%; height: 100%; object-fit: contain; }
        h1 { margin: 0; font-size: 28px; } .muted { color: #4b5563; } .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; } table { width: 100%; border-collapse: collapse; margin-top: 18px; page-break-inside: auto; } thead { display: table-header-group; } tr { page-break-inside: avoid; } th { background: #f3f4f6; text-align: left; } th, td { border-bottom: 1px solid #e5e7eb; padding: 9px; } .right { text-align: right; } .summary { margin-left: auto; width: 260px; } .signature { break-inside: avoid; margin-top: 44px; padding-top: 12px; font-weight: 700; }
      </style>
      <div class="top"><div><div class="logo">${this.logoContent(tenant)}</div><strong>${this.escape(this.companyName(tenant))}</strong><br/><span class="muted">${this.escape(this.companyAddress(tenant) || "Adresse non définie")}</span><br/><span class="muted">${this.escape(this.companyPhone(tenant) || "Téléphone non défini")}</span><br/><span class="muted">${this.escape(this.companyEmail(tenant) || "Email non d?fini")}</span>${this.companyTax(tenant) ? `<br/><span class="muted">NIF: ${this.escape(this.companyTax(tenant))}</span>` : ""}</div><div class="right"><h1>FACTURE</h1><p><strong>${this.escape(invoice.documentNumber)}</strong></p><p>Date: ${this.date(invoice.createdAt)}<br/>Échéance: ${this.date(invoice.issuedAt ?? invoice.createdAt)}</p></div></div>
      <div class="box" style="margin-top:24px"><strong>Client</strong><br/>${this.escape(invoice.customer?.displayName ?? "Client comptoir")}<br/><span class="muted">${this.escape(invoice.customer?.address ?? "Adresse client non d?finie")}</span><br/><span class="muted">${this.escape(invoice.customer?.email ?? "Email client non defini")}</span></div>
      <table><thead><tr><th>Produits / services</th><th class="right">Qte</th><th class="right">Prix</th><th class="right">Remise</th><th class="right">Taxes</th><th class="right">Total</th></tr></thead><tbody>${invoice.items.map((item) => `<tr><td>${this.escape(this.itemName(item))}${item.productId ? "" : `<br/><span class="muted">Article personnalisé</span>`}</td><td class="right">${item.quantity}</td><td class="right">${this.money(item.unitPrice)}</td><td class="right">${this.money(item.discount)}</td><td class="right">${this.money(item.tax)}</td><td class="right">${this.money(item.total)}</td></tr>`).join("")}</tbody></table>
      <table class="summary"><tr><td>Sous-total</td><td class="right">${this.money(invoice.subtotal)}</td></tr><tr><td>Remise</td><td class="right">${this.money(invoice.discount)}</td></tr><tr><td>Taxes</td><td class="right">${this.money(invoice.tax)}</td></tr><tr><td><strong>Total</strong></td><td class="right"><strong>${this.money(invoice.total)}</strong></td></tr><tr><td>Montant réglé</td><td class="right">${this.money(paid)}</td></tr><tr><td>Montant reçu</td><td class="right">${this.money(received)}</td></tr><tr><td>Monnaie rendue</td><td class="right">${this.money(change)}</td></tr><tr><td>Solde</td><td class="right">${this.money(invoice.balance)}</td></tr></table>
      <p><strong>Notes</strong><br/>${this.escape(invoice.notes ?? "Aucune note")}</p><div class="signature">Signature autorisée : ______________________________</div>
    `);
  }

  async invoicePdf(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId }, include: { tenant: { include: { companyProfile: true, logo: true } }, customer: true, items: { include: { product: true } }, payments: true } });
    if (!invoice) throw new NotFoundException("Facture introuvable");
    const tenant = invoice.tenant as BrandedTenant;
    const lines = [
      this.companyName(tenant),
      this.companyAddress(tenant),
      this.companyPhone(tenant),
      this.companyEmail(tenant),
      this.companyTax(tenant) ? `NIF: ${this.companyTax(tenant)}` : "",
      `Facture: ${invoice.documentNumber}`,
      `Client: ${invoice.customer?.displayName ?? "Client comptoir"}`,
      `Date: ${this.date(invoice.createdAt)}`,
      ...invoice.items.map((item) => `${this.itemName(item)}${item.productId ? "" : " (Article personnalisé)"} x${item.quantity} ${this.money(item.total)}`),
      `Total: ${this.money(invoice.total)}`,
      `Montant réglé: ${this.money(summarizePayments(invoice.total, invoice.payments).settledAmount)}`,
      `Montant reçu: ${this.money(summarizePayments(invoice.total, invoice.payments).receivedAmount)}`,
      `Monnaie rendue: ${this.money(summarizePayments(invoice.total, invoice.payments).changeAmount)}`,
      `Solde: ${this.money(invoice.balance)}`
    ].filter(Boolean);
    return this.pdf.createTextPdf(`Facture ${invoice.documentNumber}`, lines);
  }

  private companyName(tenant: BrandedTenant) { return tenant.companyProfile?.companyName ?? tenant.companyProfile?.name ?? tenant.name ?? "Mon entreprise"; }
  private companyPhone(tenant: BrandedTenant) { return tenant.companyProfile?.phone ?? tenant.phone ?? ""; }
  private companyEmail(tenant: BrandedTenant) { return tenant.companyProfile?.email ?? tenant.email ?? ""; }
  private companyAddress(tenant: BrandedTenant) { return tenant.companyProfile?.address ?? tenant.address ?? ""; }
  private companyTax(tenant: BrandedTenant) { return tenant.companyProfile?.taxNumber ?? ""; }
  private logoUrl(tenant: BrandedTenant) { return tenant.companyProfile?.logoUrl ?? tenant.logo?.url ?? ""; }
  private logoContent(tenant: BrandedTenant) { const logo = this.logoUrl(tenant); return logo ? `<img src="${this.escape(logo)}" alt="Logo"/>` : this.escape(this.initials(this.companyName(tenant))); }
  private itemName(item: { product?: { name?: string | null } | null; customName?: string | null }) { return item.product?.name ?? item.customName ?? "Article personnalisé"; }
  private initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME"; }
  private page(title: string, body: string) { return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${this.escape(title)}</title></head><body>${body}<script>window.addEventListener('load',()=>document.body.dataset.ready='true')</script></body></html>`; }
  private money(value: unknown) { return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  private date(value: Date) { return new Intl.DateTimeFormat("fr-HT", { dateStyle: "medium", timeStyle: "short" }).format(value); }
  private escape(value: string) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
}





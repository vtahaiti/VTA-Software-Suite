import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PdfService } from "./pdf.service";
import { summarizePayments } from "../common/payment-business-rules";
import { formatBusinessDateTime, normalizeBusinessTimeZone } from "../common/business-timezone";

type PaperFormat = "a4" | "letter";
type ReceiptWidth = "58" | "72" | "80";
type BrandedTenant = { name: string; address?: string | null; phone?: string | null; email?: string | null; timezone?: string | null; companyProfile?: { companyName?: string | null; name?: string | null; logoUrl?: string | null; phone?: string | null; email?: string | null; address?: string | null; taxNumber?: string | null; timezone?: string | null } | null; settings?: { timezone?: string | null } | null; logo?: { url?: string | null } | null };

@Injectable()
export class InvoicePrintService {
  constructor(private readonly prisma: PrismaService, private readonly pdf: PdfService) {}

  async renderReceipt(tenantId: string, saleId: string, width: ReceiptWidth = "80") {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { tenant: { include: { companyProfile: true, settings: true, logo: true } }, customer: true, items: { include: { product: true } }, payments: true, receipt: true, cashSession: { include: { cashRegister: true } } }
    });
    if (!sale) throw new NotFoundException("Vente introuvable");
    const tenant = sale.tenant as BrandedTenant;
    const cashier = sale.createdById ? await this.prisma.user.findFirst({ where: { id: sale.createdById, tenantId }, select: { name: true } }) : null;
    const paymentSummary = summarizePayments(sale.total, sale.payments);
    const paid = paymentSummary.settledAmount;
    const received = paymentSummary.receivedAmount;
    const change = paymentSummary.changeAmount;
    const balance = Math.max(0, Number(sale.total ?? 0) - Number(paid ?? 0));
    const widthConfig = receiptWidthConfig(width);
    const receiptNumber = this.displayReceiptNumber(tenantId, sale.receipt?.number ?? sale.id);
    const paymentMethods = this.paymentMethods(sale.payments);
    const timeZone = this.tenantTimeZone(tenant);
    return this.page(`Ticket ${receiptNumber}`, `
      <style>
        @page { size: ${widthConfig.pageWidthMm}mm auto; margin: 0; }
        @media print {
          @page { size: ${widthConfig.pageWidthMm}mm auto; margin: 0; }
          html, body { width: ${widthConfig.pageWidthMm}mm; margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
        *, *::before, *::after { box-sizing: border-box; max-width: 100%; }
        html, body { width: ${widthConfig.pageWidthMm}mm; max-width: ${widthConfig.pageWidthMm}mm; margin: 0; padding: 0; background: #fff; overflow-x: hidden; }
        body { font-family: Consolas, "Courier New", ui-monospace, SFMono-Regular, Menlo, monospace; font-size: ${widthConfig.fontSize}; font-weight: 600; line-height: 1.25; color: #000; -webkit-font-smoothing: none; print-color-adjust: exact; }
        .ticket { width: 100%; max-width: ${widthConfig.contentWidthMm}mm; margin: 0 auto; padding: ${widthConfig.safePadding}; box-sizing: border-box; overflow: hidden; }
        .ticket-inner { width: 100%; max-width: ${widthConfig.usefulWidth}; margin: 0 auto; overflow: hidden; }
        .center { text-align: center; }
        .logo { width: ${widthConfig.logoSize}; height: ${widthConfig.logoSize}; margin: 0 auto 5px; border: 1px solid #d1d5db; border-radius: 999px; display: grid; place-items: center; font-weight: 800; font-size: 12px; overflow: hidden; }
        .logo img { width: 100%; height: 100%; object-fit: contain; padding: 4px; filter: grayscale(1) contrast(1.15); }
        .company { display: block; font-size: ${widthConfig.companyFontSize}; letter-spacing: .2px; text-transform: uppercase; overflow-wrap: anywhere; }
        .muted { color: #4b5563; overflow-wrap: anywhere; }
        .line { border-top: 1px dashed #6b7280; margin: 7px 0; }
        .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, ${widthConfig.amountWidth}); column-gap: 1.5mm; align-items: start; padding: 2px 0; width: 100%; }
        .label { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
        .amount { min-width: 0; max-width: ${widthConfig.amountWidth}; justify-self: end; text-align: right; white-space: normal; overflow-wrap: anywhere; word-break: break-word; font-variant-numeric: tabular-nums; }
        .meta .label, .summary .label { color: #4b5563; }
        .meta .amount { color: #111827; }
        .item-name { font-weight: 800; overflow-wrap: anywhere; word-break: break-word; }
        .item-note { color: #4b5563; font-size: 9px; overflow-wrap: anywhere; }
        .total-row { margin-top: 3px; padding-top: 5px; font-size: ${widthConfig.totalFontSize}; font-weight: 900; border-top: 1px solid #111827; }
        .thanks { margin-top: 8px; font-weight: 800; text-align: center; }
        .legal { margin-top: 2px; text-align: center; font-size: 9px; color: #6b7280; }
      </style>
      <div class="ticket">
      <div class="ticket-inner">
        <div class="center">
          <div class="logo">${this.logoContent(tenant)}</div>
          <strong class="company">${this.escape(this.companyName(tenant))}</strong><br/>
          ${this.companyAddress(tenant) ? `<span class="muted">${this.escape(this.companyAddress(tenant))}</span><br/>` : ""}
          ${this.companyPhone(tenant) ? `<span class="muted">Tel: ${this.escape(this.companyPhone(tenant))}</span><br/>` : ""}
          ${this.companyEmail(tenant) ? `<span class="muted">${this.escape(this.companyEmail(tenant))}</span><br/>` : ""}
          ${this.companyTax(tenant) ? `<span class="muted">NIF: ${this.escape(this.companyTax(tenant))}</span><br/>` : ""}
        </div>
        <div class="line"></div>
        <div class="meta"><div class="row"><span class="label">Ticket</span><strong class="amount">#${this.escape(receiptNumber)}</strong></div><div class="row"><span class="label">Date</span><strong class="amount">${this.date(sale.createdAt, timeZone)}</strong></div><div class="row"><span class="label">Caissier</span><strong class="amount">${this.escape(cashier?.name ?? sale.cashSession?.cashRegister?.name ?? "Caisse")}</strong></div><div class="row"><span class="label">Client</span><strong class="amount">${this.escape(sale.customer?.displayName ?? "Client comptoir")}</strong></div></div>
        <div class="line"></div>
        <div>${sale.items.map((item) => `<div class="row"><div class="label"><div class="item-name">${this.escape(this.itemName(item))}</div>${item.productId ? "" : `<div class="item-note">${this.escape(this.customItemLabel(item.customType))}</div>`}<div class="item-note">${item.quantity} x ${this.money(item.unitPrice)}${Number(item.discount) > 0 ? ` - remise ${this.money(item.discount)}` : ""}</div></div><strong class="amount">${this.money(item.total)}</strong></div>`).join("")}</div>
        <div class="line"></div>
        <div class="summary"><div class="row"><span class="label">Sous-total</span><strong class="amount">${this.money(sale.subtotal)}</strong></div>${Number(sale.discount) > 0 ? `<div class="row"><span class="label">Remise</span><strong class="amount">${this.money(sale.discount)}</strong></div>` : ""}${Number(sale.tax) > 0 ? `<div class="row"><span class="label">Taxes</span><strong class="amount">${this.money(sale.tax)}</strong></div>` : ""}<div class="row total-row"><span class="label">Total</span><strong class="amount">${this.money(sale.total)}</strong></div><div class="row"><span class="label">Montant réglé</span><strong class="amount">${this.money(paid)}</strong></div><div class="row"><span class="label">Montant reçu</span><strong class="amount">${this.money(received)}</strong></div><div class="row"><span class="label">Monnaie rendue</span><strong class="amount">${this.money(change)}</strong></div>${paymentMethods ? `<div class="row"><span class="label">Méthode</span><strong class="amount">${this.escape(paymentMethods)}</strong></div>` : ""}${balance > 0 ? `<div class="row"><span class="label">Reste à payer</span><strong class="amount">${this.money(balance)}</strong></div>` : ""}</div>
        <div class="line"></div>
        <div class="thanks">Merci pour votre achat</div>
        <div class="legal">Conservez ce ticket comme preuve de paiement.</div>
      </div>
      </div>
    `);
  }

  async renderInvoice(tenantId: string, invoiceId: string, format: PaperFormat = "letter") {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { tenant: { include: { companyProfile: true, settings: true, logo: true } }, customer: true, items: { include: { product: true } }, payments: true }
    });
    if (!invoice) throw new NotFoundException("Facture introuvable");
    const tenant = invoice.tenant as BrandedTenant;
    const timeZone = this.tenantTimeZone(tenant);
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
      <div class="top"><div><div class="logo">${this.logoContent(tenant)}</div><strong>${this.escape(this.companyName(tenant))}</strong><br/><span class="muted">${this.escape(this.companyAddress(tenant) || "Adresse non définie")}</span><br/><span class="muted">${this.escape(this.companyPhone(tenant) || "Téléphone non défini")}</span><br/><span class="muted">${this.escape(this.companyEmail(tenant) || "Email non d?fini")}</span>${this.companyTax(tenant) ? `<br/><span class="muted">NIF: ${this.escape(this.companyTax(tenant))}</span>` : ""}</div><div class="right"><h1>FACTURE</h1><p><strong>${this.escape(invoice.documentNumber)}</strong></p><p>Date: ${this.date(invoice.createdAt, timeZone)}<br/>Échéance: ${this.date(invoice.issuedAt ?? invoice.createdAt, timeZone)}</p></div></div>
      <div class="box" style="margin-top:24px"><strong>Client</strong><br/>${this.escape(invoice.customer?.displayName ?? "Client comptoir")}<br/><span class="muted">${this.escape(invoice.customer?.address ?? "Adresse client non d?finie")}</span><br/><span class="muted">${this.escape(invoice.customer?.email ?? "Email client non defini")}</span></div>
      <table><thead><tr><th>Produits / services</th><th class="right">Qte</th><th class="right">Prix</th><th class="right">Remise</th><th class="right">Taxes</th><th class="right">Total</th></tr></thead><tbody>${invoice.items.map((item) => `<tr><td>${this.escape(this.itemName(item))}${item.productId ? "" : `<br/><span class="muted">Article personnalisé</span>`}</td><td class="right">${item.quantity}</td><td class="right">${this.money(item.unitPrice)}</td><td class="right">${this.money(item.discount)}</td><td class="right">${this.money(item.tax)}</td><td class="right">${this.money(item.total)}</td></tr>`).join("")}</tbody></table>
      <table class="summary"><tr><td>Sous-total</td><td class="right">${this.money(invoice.subtotal)}</td></tr><tr><td>Remise</td><td class="right">${this.money(invoice.discount)}</td></tr><tr><td>Taxes</td><td class="right">${this.money(invoice.tax)}</td></tr><tr><td><strong>Total</strong></td><td class="right"><strong>${this.money(invoice.total)}</strong></td></tr><tr><td>Montant réglé</td><td class="right">${this.money(paid)}</td></tr><tr><td>Montant reçu</td><td class="right">${this.money(received)}</td></tr><tr><td>Monnaie rendue</td><td class="right">${this.money(change)}</td></tr><tr><td>Solde</td><td class="right">${this.money(invoice.balance)}</td></tr></table>
      <p><strong>Notes</strong><br/>${this.escape(invoice.notes ?? "Aucune note")}</p><div class="signature">Signature autorisée : ______________________________</div>
    `);
  }

  async invoicePdf(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId }, include: { tenant: { include: { companyProfile: true, settings: true, logo: true } }, customer: true, items: { include: { product: true } }, payments: true } });
    if (!invoice) throw new NotFoundException("Facture introuvable");
    const tenant = invoice.tenant as BrandedTenant;
    const timeZone = this.tenantTimeZone(tenant);
    const lines = [
      this.companyName(tenant),
      this.companyAddress(tenant),
      this.companyPhone(tenant),
      this.companyEmail(tenant),
      this.companyTax(tenant) ? `NIF: ${this.companyTax(tenant)}` : "",
      `Facture: ${invoice.documentNumber}`,
      `Client: ${invoice.customer?.displayName ?? "Client comptoir"}`,
      `Date: ${this.date(invoice.createdAt, timeZone)}`,
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
  private logoUrl(tenant: BrandedTenant) { return this.absoluteAssetUrl(tenant.companyProfile?.logoUrl ?? tenant.logo?.url ?? ""); }
  private logoContent(tenant: BrandedTenant) { const logo = this.logoUrl(tenant); return logo ? `<img src="${this.escape(logo)}" alt="Logo" crossorigin="anonymous" onerror="this.remove()"/>` : this.escape(this.initials(this.companyName(tenant))); }
  private itemName(item: { product?: { name?: string | null } | null; customName?: string | null }) { return item.product?.name ?? item.customName ?? "Article personnalisé"; }
  private customItemLabel(value?: string | null) { return value ? `Article personnalisé - ${value}` : "Article personnalisé"; }
  private paymentMethods(payments: Array<{ method?: string | null }>) { return [...new Set(payments.map((payment) => payment.method).filter(Boolean))].join(", "); }
  private initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME"; }
  private displayReceiptNumber(tenantId: string, receiptNumber: string) {
    const prefix = `${tenantId}-`;
    return receiptNumber.startsWith(prefix) ? receiptNumber.slice(prefix.length) : receiptNumber;
  }
  private page(title: string, body: string) { return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${this.escape(title)}</title></head><body>${body}<script>window.addEventListener('load',()=>document.body.dataset.ready='true')</script></body></html>`; }
  private money(value: unknown) { return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  private tenantTimeZone(tenant: BrandedTenant) { return normalizeBusinessTimeZone(tenant.settings?.timezone ?? tenant.companyProfile?.timezone ?? tenant.timezone); }
  private date(value: Date, timeZone?: string | null) { return formatBusinessDateTime(value, timeZone); }
  private escape(value: string) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  private absoluteAssetUrl(value: string) {
    if (!value) return "";
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value;
    const baseUrl = process.env.API_PUBLIC_URL ?? process.env.PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "https://api.vtaerp.com";
    return `${baseUrl.replace(/\/$/, "")}${value.startsWith("/") ? value : `/${value}`}`;
  }
}

function receiptWidthConfig(width: ReceiptWidth) {
  if (width === "58") {
    return {
      pageWidthMm: 58,
      contentWidthMm: 58,
      safePadding: "2mm",
      usefulWidth: "54mm",
      amountWidth: "21mm",
      fontSize: "10px",
      totalFontSize: "12px",
      companyFontSize: "11px",
      logoSize: "36px"
    };
  }

  return {
    pageWidthMm: width === "80" ? 80 : 72,
    contentWidthMm: 72,
    safePadding: "3mm",
    usefulWidth: "66mm",
    amountWidth: "24mm",
    fontSize: "11px",
    totalFontSize: "13px",
    companyFontSize: "12px",
    logoSize: "40px"
  };
}





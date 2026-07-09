import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PdfService } from "./pdf.service";

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
    const paid = sale.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const change = Math.max(0, paid - Number(sale.total));
    const widthMm = width === "58" ? 58 : 80;
    return this.page(`Ticket ${sale.receipt?.number ?? sale.id}`, `
      <style>
        @page { size: ${widthMm}mm auto; margin: 3mm; }
        body { width: ${widthMm - 6}mm; font-family: Arial, sans-serif; font-size: ${width === "58" ? "10px" : "12px"}; color: #111827; }
        .center { text-align: center; } .logo { width: 42px; height: 42px; margin: 0 auto 4px; border: 1px solid #111827; border-radius: 8px; display: grid; place-items: center; font-weight: 700; overflow: hidden; } .logo img { width: 100%; height: 100%; object-fit: cover; }
        .line { border-top: 1px dashed #111827; margin: 8px 0; } table { width: 100%; border-collapse: collapse; } td { padding: 2px 0; vertical-align: top; } .right { text-align: right; } .muted { color: #4b5563; } .qr { margin: 10px auto 0; width: 54px; height: 54px; border: 1px dashed #111827; display: grid; place-items: center; font-size: 9px; }
      </style>
      <div class="center"><div class="logo">${this.logoContent(tenant)}</div><strong>${this.escape(this.companyName(tenant))}</strong><br/><span class="muted">${this.escape(this.companyPhone(tenant) || "Telephone non defini")}</span><br/><span class="muted">${this.escape(this.companyAddress(tenant) || "Adresse non definie")}</span>${this.companyTax(tenant) ? `<br/><span class="muted">NIF: ${this.escape(this.companyTax(tenant))}</span>` : ""}</div>
      <div class="line"></div>
      <table><tr><td>Ticket</td><td class="right">${this.escape(sale.receipt?.number ?? sale.id)}</td></tr><tr><td>Date</td><td class="right">${this.date(sale.createdAt)}</td></tr><tr><td>Caissier</td><td class="right">${this.escape(sale.cashSession?.cashRegister?.name ?? "Caisse")}</td></tr><tr><td>Client</td><td class="right">${this.escape(sale.customer?.displayName ?? "Client comptoir")}</td></tr></table>
      <div class="line"></div>
      <table>${sale.items.map((item) => `<tr><td>${this.escape(this.itemName(item))}${item.productId ? "" : `<br/><span class="muted">Article personnalise</span>`}<br/><span class="muted">${item.quantity} x ${this.money(item.unitPrice)} remise ${this.money(item.discount)}</span></td><td class="right">${this.money(item.total)}</td></tr>`).join("")}</table>
      <div class="line"></div>
      <table><tr><td>Sous-total</td><td class="right">${this.money(sale.subtotal)}</td></tr><tr><td>Remise</td><td class="right">${this.money(sale.discount)}</td></tr><tr><td>Taxes</td><td class="right">${this.money(sale.tax)}</td></tr><tr><td><strong>Total</strong></td><td class="right"><strong>${this.money(sale.total)}</strong></td></tr><tr><td>Montant paye</td><td class="right">${this.money(paid)}</td></tr><tr><td>Monnaie rendue</td><td class="right">${this.money(change)}</td></tr></table>
      <div class="line"></div><div class="center">Merci pour votre achat<br/><span class="muted">QR Code prepare</span><div class="qr">QR</div></div>
    `);
  }

  async renderInvoice(tenantId: string, invoiceId: string, format: PaperFormat = "letter") {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { tenant: { include: { companyProfile: true, logo: true } }, customer: true, items: { include: { product: true } }, payments: true }
    });
    if (!invoice) throw new NotFoundException("Facture introuvable");
    const tenant = invoice.tenant as BrandedTenant;
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const pageSize = format === "a4" ? "A4" : "Letter";
    return this.page(`Facture ${invoice.documentNumber}`, `
      <style>
        @page { size: ${pageSize}; margin: 16mm; }
        body { font-family: Arial, sans-serif; color: #111827; font-size: 12px; } .top { display: flex; justify-content: space-between; gap: 24px; } .logo { width: 64px; height: 64px; border: 1px solid #111827; border-radius: 10px; display: grid; place-items: center; font-weight: 700; margin-bottom: 8px; overflow: hidden; } .logo img { width: 100%; height: 100%; object-fit: cover; }
        h1 { margin: 0; font-size: 28px; } .muted { color: #4b5563; } .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; } table { width: 100%; border-collapse: collapse; margin-top: 18px; } th { background: #f3f4f6; text-align: left; } th, td { border-bottom: 1px solid #e5e7eb; padding: 9px; } .right { text-align: right; } .summary { margin-left: auto; width: 260px; } .signature { margin-top: 44px; border-top: 1px solid #111827; width: 220px; padding-top: 6px; text-align: center; }
      </style>
      <div class="top"><div><div class="logo">${this.logoContent(tenant)}</div><strong>${this.escape(this.companyName(tenant))}</strong><br/><span class="muted">${this.escape(this.companyAddress(tenant) || "Adresse non definie")}</span><br/><span class="muted">${this.escape(this.companyPhone(tenant) || "Telephone non defini")}</span><br/><span class="muted">${this.escape(this.companyEmail(tenant) || "Email non defini")}</span>${this.companyTax(tenant) ? `<br/><span class="muted">NIF: ${this.escape(this.companyTax(tenant))}</span>` : ""}</div><div class="right"><h1>FACTURE</h1><p><strong>${this.escape(invoice.documentNumber)}</strong></p><p>Date: ${this.date(invoice.createdAt)}<br/>Echeance: ${this.date(invoice.issuedAt ?? invoice.createdAt)}</p></div></div>
      <div class="box" style="margin-top:24px"><strong>Client</strong><br/>${this.escape(invoice.customer?.displayName ?? "Client comptoir")}<br/><span class="muted">${this.escape(invoice.customer?.address ?? "Adresse client non definie")}</span><br/><span class="muted">${this.escape(invoice.customer?.email ?? "Email client non defini")}</span></div>
      <table><thead><tr><th>Produits / services</th><th class="right">Qte</th><th class="right">Prix</th><th class="right">Remise</th><th class="right">Taxes</th><th class="right">Total</th></tr></thead><tbody>${invoice.items.map((item) => `<tr><td>${this.escape(this.itemName(item))}${item.productId ? "" : `<br/><span class="muted">Article personnalise</span>`}</td><td class="right">${item.quantity}</td><td class="right">${this.money(item.unitPrice)}</td><td class="right">${this.money(item.discount)}</td><td class="right">${this.money(item.tax)}</td><td class="right">${this.money(item.total)}</td></tr>`).join("")}</tbody></table>
      <table class="summary"><tr><td>Sous-total</td><td class="right">${this.money(invoice.subtotal)}</td></tr><tr><td>Remise</td><td class="right">${this.money(invoice.discount)}</td></tr><tr><td>Taxes</td><td class="right">${this.money(invoice.tax)}</td></tr><tr><td><strong>Total</strong></td><td class="right"><strong>${this.money(invoice.total)}</strong></td></tr><tr><td>Montant paye</td><td class="right">${this.money(paid)}</td></tr><tr><td>Solde</td><td class="right">${this.money(invoice.balance)}</td></tr></table>
      <p><strong>Notes</strong><br/>${this.escape(invoice.notes ?? "Aucune note")}</p><div class="signature">Signature preparee</div>
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
      ...invoice.items.map((item) => `${this.itemName(item)}${item.productId ? "" : " (Article personnalise)"} x${item.quantity} ${this.money(item.total)}`),
      `Total: ${this.money(invoice.total)}`,
      `Paye: ${this.money(invoice.paidAmount)}`,
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
  private itemName(item: { product?: { name?: string | null } | null; customName?: string | null }) { return item.product?.name ?? item.customName ?? "Article personnalise"; }
  private initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME"; }
  private page(title: string, body: string) { return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${this.escape(title)}</title></head><body>${body}<script>window.addEventListener('load',()=>document.body.dataset.ready='true')</script></body></html>`; }
  private money(value: unknown) { return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  private date(value: Date) { return new Intl.DateTimeFormat("fr-HT", { dateStyle: "medium", timeStyle: "short" }).format(value); }
  private escape(value: string) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
}

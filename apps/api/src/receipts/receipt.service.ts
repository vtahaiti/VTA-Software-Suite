import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async createForSale(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { tenant: { include: { companyProfile: true, logo: true } }, items: { include: { product: true } }, payments: true }
    });
    if (!sale) throw new NotFoundException("Vente introuvable");
    const companyName = sale.tenant.companyProfile?.companyName ?? sale.tenant.companyProfile?.name ?? sale.tenant.name ?? "Mon entreprise";
    const phone = sale.tenant.companyProfile?.phone ?? sale.tenant.phone ?? "";
    const address = sale.tenant.companyProfile?.address ?? sale.tenant.address ?? "";
    const taxNumber = sale.tenant.companyProfile?.taxNumber ?? "";
    const number = `RCT-${Date.now().toString(36).toUpperCase()}`;
    const lines = sale.items.map((item) => `${item.product?.name ?? item.customName ?? "Article personnalise"}${item.productId ? "" : " (Article personnalise)"} x${item.quantity} ${item.total}`).join("\n");
    const content = `${companyName}\n${phone}\n${address}\n${taxNumber ? `NIF: ${taxNumber}\n` : ""}Recu ${number}\n${lines}\nTotal: ${sale.total}`;
    return this.prisma.receipt.create({ data: { saleId, number, content } });
  }

  findBySale(saleId: string) { return this.prisma.receipt.findUnique({ where: { saleId } }); }
  async markPrinted(id: string) { return this.prisma.receipt.update({ where: { id }, data: { printedAt: new Date() } }); }
}

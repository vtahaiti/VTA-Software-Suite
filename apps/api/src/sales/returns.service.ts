import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { CreateReturnDto } from "./dto/create-return.dto";
import { generateDocumentNumber, withDocumentNumber, withDocumentNumbers } from "./sales-documents.util";

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService, private readonly stock: StockService) {}
  async findAll(tenantId: string) { const items=await this.prisma.salesReturn.findMany({ where: { tenantId }, include: { customer: true, invoice: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" } }); return withDocumentNumbers(items); }
  async create(tenantId: string, dto: CreateReturnDto, createdById?: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, tenantId }, include: { items: true } });
    if (!invoice) throw new NotFoundException("Facture introuvable");
    if (invoice.status === "CANCELLED") throw new BadRequestException("Facture annulee");
    const items = dto.items.map((item) => { const invoiceItem = item.invoiceItemId ? invoice.items.find((candidate) => candidate.id === item.invoiceItemId) : invoice.items.find((candidate) => candidate.productId === item.productId); if (!invoiceItem) throw new NotFoundException("Ligne de facture introuvable"); if (item.quantity > invoiceItem.quantity) throw new BadRequestException("Quantite retournee invalide"); return { invoiceItem, quantity: item.quantity }; });
    const totals = items.reduce((acc, item) => { const ratio = item.quantity / item.invoiceItem.quantity; acc.subtotal += Number(item.invoiceItem.unitPrice) * item.quantity; acc.discount += Number(item.invoiceItem.discount) * ratio; acc.tax += Number(item.invoiceItem.tax) * ratio; acc.total += Number(item.invoiceItem.total) * ratio; return acc; }, { subtotal: 0, discount: 0, tax: 0, total: 0 });
    const salesReturn = await this.prisma.salesReturn.create({ data: { tenantId, customerId: invoice.customerId, invoiceId: invoice.id, documentNumber: generateDocumentNumber("RET"), notes: dto.notes, createdById, ...totals, paidAmount: 0, balance: 0, items: { create: items.map(({ invoiceItem, quantity }) => ({ invoiceItemId: invoiceItem.id, productId: invoiceItem.productId, quantity, unitPrice: invoiceItem.unitPrice, discount: Number(invoiceItem.discount) * (quantity / invoiceItem.quantity), tax: Number(invoiceItem.tax) * (quantity / invoiceItem.quantity), total: Number(invoiceItem.total) * (quantity / invoiceItem.quantity) })) } }, include: { items: true, invoice: true } });
    await this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: "RETURNED" } });
    for (const { invoiceItem, quantity } of items) { await this.stock.stockIn(tenantId, { productId: invoiceItem.productId, warehouseId: dto.warehouseId, quantity, reference: salesReturn.documentNumber, note: "Retour vente avancee" }); }
    return withDocumentNumber(salesReturn);
  }
}
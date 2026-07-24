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
    const { salesReturn, items } = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: dto.invoiceId, tenantId }, include: { items: true } });
      if (!invoice) throw new NotFoundException("Facture introuvable");
      if (invoice.status === "CANCELLED") throw new BadRequestException("Facture annulée");
      // Verrou de ligne explicite sur la facture : le SELECT des retours precedents ci-dessous ne
      // prend pas de verrou par lui-meme, donc sans ce FOR UPDATE, deux retours concurrents sur la
      // meme facture pourraient tous les deux lire "aucun retour anterieur" avant que l'un des deux
      // ne valide, et depasser ensemble la quantite vendue. Ce verrou force la deuxieme transaction a
      // attendre que la premiere valide avant de relire l'etat des retours.
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoice.id} FOR UPDATE`;
      // Cap contre les retours deja effectues sur cette facture (l'ancien code ne comparait la
      // quantite demandee qu'a la quantite d'origine de la ligne, donc la meme ligne pouvait etre
      // retournee plusieurs fois au-dela de ce qui a ete vendu).
      const priorReturnRows = await tx.salesReturnItem.findMany({
        where: { invoiceItemId: { in: invoice.items.map((invoiceItem) => invoiceItem.id) }, salesReturn: { invoiceId: invoice.id } },
        select: { invoiceItemId: true, quantity: true }
      });
      const priorReturnedByItem = new Map<string, number>();
      for (const row of priorReturnRows) {
        if (!row.invoiceItemId) continue;
        priorReturnedByItem.set(row.invoiceItemId, (priorReturnedByItem.get(row.invoiceItemId) ?? 0) + row.quantity);
      }
      const items = dto.items.map((item) => {
        const invoiceItem = item.invoiceItemId ? invoice.items.find((candidate) => candidate.id === item.invoiceItemId) : invoice.items.find((candidate) => candidate.productId === item.productId);
        if (!invoiceItem) throw new NotFoundException("Ligne de facture introuvable");
        if (!invoiceItem.productId) throw new BadRequestException("Les articles personnalisés ne peuvent pas etre retournes au stock");
        const alreadyReturned = priorReturnedByItem.get(invoiceItem.id) ?? 0;
        const remaining = invoiceItem.quantity - alreadyReturned;
        if (item.quantity > remaining) throw new BadRequestException(`Quantité retournée invalide : il reste ${remaining} unité(s) retournable(s) sur cette ligne`);
        return { invoiceItem: { ...invoiceItem, productId: invoiceItem.productId }, quantity: item.quantity };
      });
      const totals = items.reduce((acc, item) => { const ratio = item.quantity / item.invoiceItem.quantity; acc.subtotal += Number(item.invoiceItem.unitPrice) * item.quantity; acc.discount += Number(item.invoiceItem.discount) * ratio; acc.tax += Number(item.invoiceItem.tax) * ratio; acc.total += Number(item.invoiceItem.total) * ratio; return acc; }, { subtotal: 0, discount: 0, tax: 0, total: 0 });
      const salesReturn = await tx.salesReturn.create({ data: { tenantId, customerId: invoice.customerId, invoiceId: invoice.id, documentNumber: generateDocumentNumber("RET"), notes: dto.notes, createdById, ...totals, paidAmount: 0, balance: 0, items: { create: items.map(({ invoiceItem, quantity }) => ({ invoiceItemId: invoiceItem.id, productId: invoiceItem.productId, quantity, unitPrice: invoiceItem.unitPrice, discount: Number(invoiceItem.discount) * (quantity / invoiceItem.quantity), tax: Number(invoiceItem.tax) * (quantity / invoiceItem.quantity), total: Number(invoiceItem.total) * (quantity / invoiceItem.quantity) })) } }, include: { items: true, invoice: true } });
      // On ne marque la facture RETURNED que si la totalite de ses lignes est desormais retournee -
      // l'ancien code marquait la facture entiere RETURNED des le premier retour partiel, ce qui
      // masquait le reste du chiffre d'affaires (encore valide) dans les rapports.
      const isFullyReturned = invoice.items.every((invoiceItem) => {
        const returned = (priorReturnedByItem.get(invoiceItem.id) ?? 0) + (items.find((i) => i.invoiceItem.id === invoiceItem.id)?.quantity ?? 0);
        return returned >= invoiceItem.quantity;
      });
      if (isFullyReturned) await tx.invoice.update({ where: { id: invoice.id }, data: { status: "RETURNED" } });
      return { salesReturn, items };
    });
    for (const { invoiceItem, quantity } of items) { await this.stock.stockIn(tenantId, { productId: invoiceItem.productId, warehouseId: dto.warehouseId, quantity, reference: salesReturn.documentNumber, note: "Retour vente avancee" }); }
    return withDocumentNumber(salesReturn);
  }
}

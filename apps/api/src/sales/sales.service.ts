import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, Prisma, SaleStatus, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { SaleQueryDto } from "./dto/sale-query.dto";

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService, private readonly stock: StockService) {}

  async findAll(tenantId: string, query: SaleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.SaleWhereInput = { tenantId, status: query.status as never };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: { items: { include: { product: true } }, payments: { include: { invoice: true } }, receipt: true, customer: true, cashSession: { include: { cashRegister: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.sale.count({ where })
    ]);
    return { items, meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async findOne(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: { include: { product: true } }, payments: { include: { invoice: true } }, receipt: true, customer: true, cashSession: { include: { cashRegister: true } } }
    });
    if (!sale) throw new NotFoundException("Vente introuvable");
    return sale;
  }

  async create(tenantId: string, dto: CreateSaleDto, userId?: string) {
    if (!dto.items?.length) throw new BadRequestException("Panier vide");

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        const customer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId } });
        if (!customer) throw new NotFoundException("Client introuvable");
      }

      if (dto.storeId) {


        const store = await tx.store.findFirst({ where: { id: dto.storeId, tenantId, status: "ACTIVE" } });


        if (!store) throw new NotFoundException("Magasin introuvable");


      }



      const warehouse = await tx.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId, isActive: true } });
      if (!warehouse) throw new NotFoundException("Entrepot introuvable");

      if (dto.cashSessionId) {
        const session = await tx.cashSession.findFirst({ where: { id: dto.cashSessionId, tenantId, status: "OPEN" } });
        if (!session) throw new BadRequestException("Session caisse fermee ou introuvable");
      }

      const productIds = [...new Set(dto.items.map((item) => item.productId))];
      const products = await tx.product.findMany({ where: { tenantId, id: { in: productIds }, isActive: true } });
      const productMap = new Map(products.map((product) => [product.id, product]));
      const taxRate = dto.taxRate ?? 0;
      const orderDiscount = dto.discount ?? 0;
      let subtotal = 0;
      let itemTax = 0;

      const saleItems = dto.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new NotFoundException("Produit introuvable");
        const unitPrice = Number(product.salePrice);
        const lineSubtotal = unitPrice * item.quantity;
        const discount = item.discount ?? 0;
        const taxable = lineSubtotal - discount;
        if (taxable < 0) throw new BadRequestException("Remise superieure au montant de la ligne");
        const tax = this.round(taxable * taxRate);
        const total = this.round(taxable + tax);
        subtotal += lineSubtotal;
        itemTax += tax;
        return { product, productId: item.productId, quantity: item.quantity, unitPrice, discount, tax, total };
      });

      const grossTotal = saleItems.reduce((sum, item) => sum + item.total, 0);
      const total = this.round(grossTotal - orderDiscount);
      if (total < 0) throw new BadRequestException("Remise superieure au total");

      const payments = dto.payments ?? [];
      const paidAmount = this.round(payments.reduce((sum, payment) => sum + payment.amount, 0));
      if (paidAmount > total && payments.some((payment) => payment.method !== "CASH")) {
        throw new BadRequestException("Le trop-percu est autorise uniquement en especes");
      }

      for (const item of saleItems) {
        const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: item.productId, warehouseId: dto.warehouseId } } });
        const available = (stock?.quantity ?? 0) - (stock?.reserved ?? 0);
        if (!stock || available < item.quantity) throw new BadRequestException(`Stock insuffisant pour ${item.product.name}`);
      }

      const sale = await tx.sale.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          storeId: dto.storeId,
          cashSessionId: dto.cashSessionId,
          subtotal: this.round(subtotal),
          discount: this.round(orderDiscount),
          tax: this.round(itemTax),
          total,
          note: dto.note,
          status: SaleStatus.COMPLETED,
          items: { create: saleItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, tax: item.tax, total: item.total })) }
        }
      });

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          documentNumber: this.documentNumber("INV"),
          status: paidAmount >= total ? SalesDocumentStatus.PAID : SalesDocumentStatus.PARTIALLY_PAID,
          subtotal: this.round(subtotal),
          discount: this.round(orderDiscount),
          tax: this.round(itemTax),
          total,
          paidAmount,
          balance: this.round(Math.max(0, total - paidAmount)),
          notes: dto.note,
          createdById: userId,
          issuedAt: new Date(),
          items: { create: saleItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, tax: item.tax, total: item.total })) }
        }
      });

      for (const payment of payments.filter((entry) => entry.amount > 0)) {
        await tx.payment.create({ data: { saleId: sale.id, invoiceId: invoice.id, method: payment.method, amount: payment.amount, reference: payment.reference } });
      }

      if (dto.cashSessionId && paidAmount > 0) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: dto.cashSessionId,
            type: "IN",
            amount: paidAmount,
            reason: paidAmount >= total ? "Encaissement vente POS" : "Acompte vente POS",
            reference: sale.id
          }
        });
      }

      for (const item of saleItems) {
        const stock = await tx.stock.findUniqueOrThrow({ where: { tenantId_productId_warehouseId: { tenantId, productId: item.productId, warehouseId: dto.warehouseId } } });
        const afterQty = stock.quantity - item.quantity;
        if (afterQty < 0) throw new BadRequestException(`Stock insuffisant pour ${item.product.name}`);
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: afterQty } });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            warehouseId: dto.warehouseId,
            type: InventoryMovementType.SALE,
            userId,
            storeId: dto.storeId,
            quantity: item.quantity,
            beforeQty: stock.quantity,
            afterQty,
            reference: sale.id,
            note: "Vente POS"
          }
        });
      }

      const receipt = await tx.receipt.create({
        data: {
          saleId: sale.id,
          number: this.documentNumber("RCT"),
          content: this.receiptContent(sale.id, saleItems, total, paidAmount)
        }
      });

      return { saleId: sale.id, invoiceId: invoice.id, receiptId: receipt.id };
    });

    const sale = await this.findOne(tenantId, result.saleId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id: result.invoiceId }, include: { items: { include: { product: true } }, payments: true } });
    return { ...sale, invoice };
  }

  async cancel(tenantId: string, id: string, userId?: string) {
    const sale = await this.findOne(tenantId, id);
    if (sale.status !== SaleStatus.COMPLETED) throw new BadRequestException("Vente non annulable");
    return this.prisma.$transaction(async (tx) => {
      const saleMovements = await tx.inventoryMovement.findMany({ where: { tenantId, reference: sale.id, type: InventoryMovementType.SALE } });
      for (const movement of saleMovements) {
        const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: movement.productId, warehouseId: movement.warehouseId } } });
        if (!stock) throw new NotFoundException("Stock introuvable pour annulation");
        const afterQty = stock.quantity + movement.quantity;
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: afterQty } });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: movement.productId,
            warehouseId: movement.warehouseId,
            type: InventoryMovementType.CANCEL_SALE,
            userId,
            storeId: movement.storeId,
            quantity: movement.quantity,
            beforeQty: stock.quantity,
            afterQty,
            reference: sale.id,
            note: "Annulation vente",
            reason: "Annulation vente"
          }
        });
      }
      return tx.sale.update({ where: { id }, data: { status: SaleStatus.CANCELLED, cancelledAt: new Date() } });
    });
  }

  async returnSale(tenantId: string, id: string, warehouseId: string, userId?: string) {
    const sale = await this.findOne(tenantId, id);
    if (sale.status === SaleStatus.RETURNED) throw new BadRequestException("Vente deja retournee");
    for (const item of sale.items) {
      await this.stock.returnStock(tenantId, { productId: item.productId, warehouseId, quantity: item.quantity, reference: sale.id, note: "Retour produit", userId, storeId: sale.storeId ?? undefined });
    }
    return this.prisma.sale.update({ where: { id }, data: { status: SaleStatus.RETURNED, returnedAt: new Date() } });
  }

  private receiptContent(saleId: string, items: Array<{ product: { name: string }; quantity: number; total: number }>, total: number, paidAmount: number) {
    const lines = items.map((item) => `${item.product.name} x${item.quantity} ${item.total.toFixed(2)}`).join("\n");
    const balance = Math.max(0, total - paidAmount);
    const change = Math.max(0, paidAmount - total);
    return `Ticket de vente\nVente ${saleId}\n${lines}\nTotal: ${total.toFixed(2)}\nPaye: ${paidAmount.toFixed(2)}\nMonnaie: ${change.toFixed(2)}\nBalance: ${balance.toFixed(2)}`;
  }

  private documentNumber(prefix: string) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

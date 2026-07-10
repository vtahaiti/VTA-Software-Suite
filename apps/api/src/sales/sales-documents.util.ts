import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SalesDocumentItemDto } from "./dto/sales-document.dto";

export function calculateDocumentTotals(items: SalesDocumentItemDto[], discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscount = items.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const tax = items.reduce((sum, item) => sum + (item.tax ?? 0), 0);
  const totalDiscount = discount + lineDiscount;
  const total = subtotal - totalDiscount + tax;
  if (total < 0) throw new BadRequestException("Total invalide");
  return { subtotal, discount: totalDiscount, tax, total, paidAmount: 0, balance: total };
}

export function mapDocumentItems(items: SalesDocumentItemDto[]) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount ?? 0,
    tax: item.tax ?? 0,
    total: item.quantity * item.unitPrice - (item.discount ?? 0) + (item.tax ?? 0)
  }));
}

export async function ensureCustomer(prisma: PrismaService, tenantId: string, customerId?: string) {
  if (!customerId) return;
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) throw new NotFoundException("Client introuvable");
}

export async function ensureProducts(prisma: PrismaService, tenantId: string, productIds: string[]) {
  const uniqueIds = [...new Set(productIds)];
  const count = await prisma.product.count({ where: { tenantId, id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) throw new NotFoundException("Un ou plusieurs produits sont introuvables");
}

export function generateDocumentNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function withDocumentNumber<T extends Record<string, any>>(document: T) {
  return { ...document, number: document.documentNumber };
}

export function withDocumentNumbers<T extends Record<string, any>>(documents: T[]) {
  return documents.map((document) => withDocumentNumber(document));
}
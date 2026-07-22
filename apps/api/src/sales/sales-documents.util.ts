import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SalesDocumentItemDto } from "./dto/sales-document.dto";

type Transaction = Prisma.TransactionClient;

export function isStockTrackedProduct(product: { minimumStock?: number | null; stocks?: unknown[]; variants?: Array<{ name?: string | null; model?: string | null }> }) {
  const variantText = (product.variants ?? []).map((variant) => `${variant.name ?? ""} ${variant.model ?? ""}`).join(" ").toLowerCase();
  const explicitlyNonStock = /non stock|non-stock|sans suivi|service|plat/.test(variantText);
  if (explicitlyNonStock) return false;
  return Number(product.minimumStock ?? 0) > 0 || Number(product.stocks?.length ?? 0) > 0;
}

export async function deductStockForItems(
  tx: Transaction,
  tenantId: string,
  warehouseId: string | undefined,
  items: Array<{ productId?: string | null; quantity: number | Prisma.Decimal }>,
  documentId: string,
  documentNumber: string,
  userId?: string
) {
  for (const item of items) {
    if (!item.productId) continue;
    const quantity = Number(item.quantity);
    const product = await tx.product.findFirst({
      where: { id: item.productId, tenantId },
      include: { variants: true, stocks: warehouseId ? { where: { warehouseId } } : { orderBy: { updatedAt: "desc" } } }
    });
    if (!product) throw new NotFoundException("Produit introuvable");
    if (!isStockTrackedProduct(product)) continue;
    const stock = product.stocks[0];
    if (!stock) throw new ConflictException(`Aucun stock disponible pour ${product.name}`);
    if (stock.quantity < quantity) throw new ConflictException(`Stock insuffisant pour ${product.name}: ${stock.quantity} disponible.`);
    const updated = await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: quantity } } });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: item.productId,
        warehouseId: stock.warehouseId,
        type: InventoryMovementType.ORDER_DELIVERY,
        userId,
        quantity,
        beforeQty: stock.quantity,
        afterQty: updated.quantity,
        reference: documentId,
        reason: "Sortie commande",
        note: documentNumber
      }
    });
  }
}

export async function restockForItems(
  tx: Transaction,
  tenantId: string,
  items: Array<{ productId?: string | null; quantity: number | Prisma.Decimal }>,
  documentId: string,
  documentNumber: string,
  userId?: string
) {
  for (const item of items) {
    if (!item.productId) continue;
    const quantity = Number(item.quantity);
    const stock = await tx.stock.findFirst({ where: { tenantId, productId: item.productId } });
    if (!stock) continue;
    const updated = await tx.stock.update({ where: { id: stock.id }, data: { quantity: { increment: quantity } } });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: item.productId,
        warehouseId: stock.warehouseId,
        type: InventoryMovementType.ADJUSTMENT,
        userId,
        quantity,
        beforeQty: stock.quantity,
        afterQty: updated.quantity,
        reference: documentId,
        reason: "Annulation commande",
        note: documentNumber
      }
    });
  }
}

export function calculateDocumentTotals(items: SalesDocumentItemDto[], discount = 0) {
  for (const item of items) {
    if (!item.productId && !item.customName?.trim()) {
      throw new BadRequestException("Chaque ligne doit contenir un produit ou un service.");
    }
  }
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
    productId: item.productId || undefined,
    customName: item.customName?.trim() || undefined,
    customType: item.customType?.trim() || undefined,
    customNote: item.customNote?.trim() || undefined,
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
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;
  const count = await prisma.product.count({ where: { tenantId, id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) throw new NotFoundException("Un ou plusieurs produits sont introuvables");
}

export function generateDocumentNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function withDocumentNumber<T extends { documentNumber?: unknown }>(document: T) {
  return { ...document, number: document.documentNumber };
}

export function withDocumentNumbers<T extends { documentNumber?: unknown }>(documents: T[]) {
  return documents.map((document) => withDocumentNumber(document));
}

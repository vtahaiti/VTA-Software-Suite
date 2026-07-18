import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, Prisma, PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { formatBusinessDateTime } from "../common/business-timezone";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";

@Injectable()
export class GoodsReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.goodsReceipt.findMany({
      where: { tenantId },
      include: { warehouse: true, purchaseOrder: { include: { supplier: true } }, items: { include: { product: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(tenantId: string, dto: CreateGoodsReceiptDto, userId?: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, tenantId },
      include: { items: { include: { product: true } } }
    });
    if (!purchaseOrder) throw new NotFoundException("Bon de commande introuvable");
    if (!([PurchaseOrderStatus.SENT, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED] as PurchaseOrderStatus[]).includes(purchaseOrder.status)) {
      throw new BadRequestException("Le bon de commande doit etre commande avant reception");
    }

    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId } });
    if (!warehouse) throw new NotFoundException("Entrepot introuvable");

    const items = dto.items.map((item) => {
      const orderItem = purchaseOrder.items.find((candidate) => candidate.id === item.purchaseOrderItemId);
      if (!orderItem) throw new NotFoundException("Ligne de commande introuvable");
      const remaining = orderItem.quantity - orderItem.receivedQty;
      if (item.quantity > remaining) throw new BadRequestException("Quantite receptionnee superieure au reste a recevoir");
      return { orderItem, quantity: item.quantity };
    });

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          tenantId,
          purchaseOrderId: dto.purchaseOrderId,
          warehouseId: dto.warehouseId,
          number: this.generateNumber("GR"),
          notes: dto.notes,
          items: {
            create: items.map(({ orderItem, quantity }) => ({
              purchaseOrderItemId: orderItem.id,
              productId: orderItem.productId,
              quantity,
              unitCost: orderItem.unitCost
            }))
          }
        },
        include: { items: true, warehouse: true, purchaseOrder: true }
      });

      for (const { orderItem, quantity } of items) {
        const itemUpdate = await tx.purchaseOrderItem.updateMany({
          where: { id: orderItem.id, receivedQty: { lte: orderItem.quantity - quantity } },
          data: { receivedQty: { increment: quantity } }
        });
        if (itemUpdate.count !== 1) throw new BadRequestException("Cette ligne a deja ete receptionnee par une autre operation");
        const currentStock = await tx.stock.upsert({
          where: { tenantId_productId_warehouseId: { tenantId, productId: orderItem.productId, warehouseId: dto.warehouseId } },
          update: {},
          create: { tenantId, productId: orderItem.productId, warehouseId: dto.warehouseId, quantity: 0, minimumStock: orderItem.product.minimumStock }
        });
        const afterQty = currentStock.quantity + quantity;
        await tx.stock.update({ where: { id: currentStock.id }, data: { quantity: afterQty } });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: orderItem.productId,
            warehouseId: dto.warehouseId,
            type: InventoryMovementType.PURCHASE,
            quantity,
            beforeQty: currentStock.quantity,
            afterQty,
            reference: receipt.number,
            note: "Reception achat",
            reason: "Reception achat",
            userId,
            storeId: warehouse.storeId ?? undefined
          }
        });
        if (dto.updateMissingCosts !== false && Number(orderItem.product.purchasePrice ?? 0) <= 0 && Number(orderItem.unitCost) > 0) {
          await tx.product.update({ where: { id: orderItem.productId }, data: { purchasePrice: orderItem.unitCost, averageCost: orderItem.unitCost } });
          await tx.priceHistory.create({
            data: {
              productId: orderItem.productId,
              purchasePrice: orderItem.unitCost,
              salePrice: orderItem.product.salePrice,
              wholesalePrice: orderItem.product.wholesalePrice,
              averageCost: orderItem.unitCost
            }
          });
        }
      }

      await this.refreshPurchaseOrderStatusTx(tx, tenantId, dto.purchaseOrderId);
      return receipt;
    });
  }

  async printReceipt(tenantId: string, id: string) {
    const receipt = await this.prisma.goodsReceipt.findFirst({ where: { id, tenantId }, include: { purchaseOrder: { include: { supplier: true } }, warehouse: true, items: { include: { product: true } } } });
    if (!receipt) throw new NotFoundException("R?ception introuvable");
    return `RÉCEPTION MARCHANDISES\nNuméro: ${receipt.number}\nFournisseur: ${receipt.purchaseOrder.supplier.name}\nDépôt: ${receipt.warehouse.name}\nDate: ${formatBusinessDateTime(new Date())}\nLignes: ${receipt.items.length}\n\nInformations entreprise, magasin et utilisateur préparées.`;
  }

  private async refreshPurchaseOrderStatusTx(tx: Prisma.TransactionClient, tenantId: string, purchaseOrderId: string) {
    const purchaseOrder = await tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId, tenantId }, include: { items: true } });
    if (!purchaseOrder) return;
    const allReceived = purchaseOrder.items.every((item) => item.receivedQty >= item.quantity);
    const partiallyReceived = purchaseOrder.items.some((item) => item.receivedQty > 0);
    const status = allReceived ? PurchaseOrderStatus.FULLY_RECEIVED : partiallyReceived ? PurchaseOrderStatus.PARTIALLY_RECEIVED : PurchaseOrderStatus.APPROVED;
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status } });
  }

  private generateNumber(prefix: string) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }
}

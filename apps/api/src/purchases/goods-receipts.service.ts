import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { formatBusinessDateTime } from "../common/business-timezone";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";

@Injectable()
export class GoodsReceiptsService {
  constructor(private readonly prisma: PrismaService, private readonly stockService: StockService) {}

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
      include: { items: true }
    });
    if (!purchaseOrder) throw new NotFoundException("Bon de commande introuvable");
    if (!([PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED] as PurchaseOrderStatus[]).includes(purchaseOrder.status)) {
      throw new BadRequestException("Le bon de commande doit ?tre valid? avant r?ception");
    }

    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId } });
    if (!warehouse) throw new NotFoundException("Entrep?t introuvable");

    const items = dto.items.map((item) => {
      const orderItem = purchaseOrder.items.find((candidate) => candidate.id === item.purchaseOrderItemId);
      if (!orderItem) throw new NotFoundException("Ligne de commande introuvable");
      const remaining = orderItem.quantity - orderItem.receivedQty;
      if (item.quantity > remaining) throw new BadRequestException("Quantit? r?ceptionn?e sup?rieure au reste ? recevoir");
      return { orderItem, quantity: item.quantity };
    });

    const receipt = await this.prisma.goodsReceipt.create({
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
      await this.prisma.purchaseOrderItem.update({ where: { id: orderItem.id }, data: { receivedQty: { increment: quantity } } });
      await this.stockService.purchase(tenantId, {
        productId: orderItem.productId,
        warehouseId: dto.warehouseId,
        quantity,
        reference: receipt.number,
        note: "R?ception achat",
        userId,
        storeId: warehouse.storeId ?? undefined
      });
    }

    await this.refreshPurchaseOrderStatus(tenantId, dto.purchaseOrderId);
    return receipt;
  }

  async printReceipt(tenantId: string, id: string) {
    const receipt = await this.prisma.goodsReceipt.findFirst({ where: { id, tenantId }, include: { purchaseOrder: { include: { supplier: true } }, warehouse: true, items: { include: { product: true } } } });
    if (!receipt) throw new NotFoundException("R?ception introuvable");
    return `RÉCEPTION MARCHANDISES\nNuméro: ${receipt.number}\nFournisseur: ${receipt.purchaseOrder.supplier.name}\nDépôt: ${receipt.warehouse.name}\nDate: ${formatBusinessDateTime(new Date())}\nLignes: ${receipt.items.length}\n\nInformations entreprise, magasin et utilisateur préparées.`;
  }

  private async refreshPurchaseOrderStatus(tenantId: string, purchaseOrderId: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, tenantId }, include: { items: true } });
    if (!purchaseOrder) return;
    const allReceived = purchaseOrder.items.every((item) => item.receivedQty >= item.quantity);
    const partiallyReceived = purchaseOrder.items.some((item) => item.receivedQty > 0);
    const status = allReceived ? PurchaseOrderStatus.FULLY_RECEIVED : partiallyReceived ? PurchaseOrderStatus.PARTIALLY_RECEIVED : PurchaseOrderStatus.APPROVED;
    await this.prisma.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status } });
  }

  private generateNumber(prefix: string) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }
}

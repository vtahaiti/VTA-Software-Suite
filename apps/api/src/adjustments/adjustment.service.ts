import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
@Injectable()
export class AdjustmentService {
  constructor(private readonly prisma: PrismaService, private readonly stock: StockService) {}
  findAll(tenantId: string) { return this.prisma.inventoryAdjustment.findMany({ where: { tenantId }, include: { warehouse: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" } }); }
  async create(tenantId: string, dto: CreateAdjustmentDto) {
    const adjustment = await this.prisma.inventoryAdjustment.create({ data: { tenantId, warehouseId: dto.warehouseId, reason: dto.reason } });
    for (const item of dto.items) {
      const current = await this.stock.getOrCreateStock(tenantId, item.productId, dto.warehouseId);
      const difference = item.countedQty - current.quantity;
      await this.prisma.inventoryAdjustmentItem.create({ data: { adjustmentId: adjustment.id, productId: item.productId, countedQty: item.countedQty, systemQty: current.quantity, difference } });
      await this.stock.adjustTo(tenantId, item.productId, dto.warehouseId, item.countedQty, adjustment.id, dto.reason);
    }
    return this.prisma.inventoryAdjustment.findUnique({ where: { id: adjustment.id }, include: { warehouse: true, items: { include: { product: true } } } });
  }
}
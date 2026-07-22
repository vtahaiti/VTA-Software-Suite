import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { STOCK_OUT_REASONS, StockOperationDto } from "./dto/stock-operation.dto";
import { StockQueryDto } from "./dto/stock-query.dto";

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: StockQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const productWhere: Prisma.ProductWhereInput = {
      tenantId,
      isActive: true,
      categoryId: query.categoryId,
      unitId: query.unitId,
      supplierId: query.supplierId,
      OR: query.search
        ? [{ name: { contains: query.search, mode: "insensitive" } }, { sku: { contains: query.search, mode: "insensitive" } }]
        : undefined
    };
    const [products, total, defaultWarehouse] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: productWhere,
        include: {
          stocks: { where: { warehouseId: query.warehouseId }, include: { warehouse: true }, orderBy: { updatedAt: "desc" } },
          category: true,
          unit: true,
          supplier: true,
          variants: true
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.warehouse.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: "asc" } })
    ]);
    const items = products.flatMap((product) => {
      const stockTracked = this.isStockTrackedProduct(product);
      const stocks = product.stocks.length ? product.stocks : [{
        id: `virtual-${product.id}-${defaultWarehouse?.id ?? "warehouse"}`,
        tenantId,
        productId: product.id,
        warehouseId: defaultWarehouse?.id ?? "",
        quantity: 0,
        reserved: 0,
        minimumStock: product.minimumStock,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        warehouse: defaultWarehouse
      }];
      return stocks.map((stock) => ({
        id: stock.id,
        tenantId,
        productId: product.id,
        warehouseId: stock.warehouseId,
        quantity: stock.quantity,
        reserved: stock.reserved,
        minimumStock: stock.minimumStock ?? product.minimumStock,
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt,
        product,
        warehouse: stock.warehouse,
        stockTracked
      }));
    });
    const stockTrackedItems = query.includeNonStock ? items : items.filter((item) => item.stockTracked);
    const filteredItems = query.lowStock ? stockTrackedItems.filter((item) => item.stockTracked && item.quantity <= item.minimumStock) : stockTrackedItems;
    const filteredTotal = query.includeNonStock && !query.lowStock ? total : filteredItems.length;
    return { items: filteredItems, meta: { page, limit, total: filteredTotal, pageCount: Math.ceil(filteredTotal / limit) } };
  }

  alerts(tenantId: string) {
    return this.prisma.stock.findMany({ where: { tenantId, quantity: { lte: 0 } }, include: { product: true, warehouse: true }, orderBy: { updatedAt: "desc" } });
  }

  async stockIn(tenantId: string, dto: StockOperationDto) {
    await this.assertManualStockAllowed(tenantId, dto.productId);
    return this.applyMovement(tenantId, dto, InventoryMovementType.IN, dto.quantity);
  }

  async stockOut(tenantId: string, dto: StockOperationDto) {
    if (!dto.reason || !STOCK_OUT_REASONS.includes(dto.reason)) {
      throw new BadRequestException("Un motif contrôlé est obligatoire pour une sortie non commerciale.");
    }
    await this.assertManualStockAllowed(tenantId, dto.productId);
    return this.applyMovement(tenantId, dto, InventoryMovementType.OUT, -dto.quantity);
  }

  purchase(tenantId: string, dto: StockOperationDto) {
    return this.applyMovement(tenantId, dto, InventoryMovementType.PURCHASE, dto.quantity);
  }

  returnStock(tenantId: string, dto: StockOperationDto) {
    return this.applyMovement(tenantId, dto, InventoryMovementType.RETURN, dto.quantity);
  }

  cancelSale(tenantId: string, dto: StockOperationDto) {
    return this.applyMovement(tenantId, dto, InventoryMovementType.CANCEL_SALE, dto.quantity);
  }

  async adjustTo(tenantId: string, productId: string, warehouseId: string, countedQty: number, reference?: string, note?: string, userId?: string, storeId?: string) {
    await this.assertManualStockAllowed(tenantId, productId);
    const stock = await this.getOrCreateStock(tenantId, productId, warehouseId);
    return this.applyMovement(tenantId, { productId, warehouseId, quantity: Math.abs(countedQty - stock.quantity), reference, note, userId, storeId }, InventoryMovementType.ADJUSTMENT, countedQty - stock.quantity);
  }

  async applyMovement(tenantId: string, dto: StockOperationDto, type: InventoryMovementType, delta: number) {
    const stock = await this.getOrCreateStock(tenantId, dto.productId, dto.warehouseId);
    const afterQty = stock.quantity + delta;
    if (afterQty < 0) throw new BadRequestException("Stock insuffisant");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.stock.update({ where: { id: stock.id }, data: { quantity: afterQty } });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          type,
          quantity: dto.quantity,
          beforeQty: stock.quantity,
          afterQty,
          reference: dto.reference,
          note: dto.note,
          reason: dto.reason ?? dto.note,
          userId: dto.userId,
          storeId: dto.storeId
        }
      });
      return updated;
    });
  }

  async getOrCreateStock(tenantId: string, productId: string, warehouseId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException("Produit introuvable");
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId } });
    if (!warehouse) throw new NotFoundException("Entrepôt introuvable");
    return this.prisma.stock.upsert({
      where: { tenantId_productId_warehouseId: { tenantId, productId, warehouseId } },
      update: {},
      create: { tenantId, productId, warehouseId, quantity: 0, minimumStock: product.minimumStock }
    });
  }

  private async assertManualStockAllowed(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { variants: true, stocks: { take: 1 } }
    });
    if (!product) throw new NotFoundException("Produit introuvable");
    if (!this.isStockTrackedProduct(product)) {
      throw new BadRequestException("Ce produit n'est pas suivi en stock.");
    }
  }

  private isStockTrackedProduct(product: { name?: string | null; category?: { name?: string | null } | null; minimumStock?: Prisma.Decimal | number | string | null; stocks?: unknown[]; variants?: { name?: string | null; model?: string | null }[] }) {
    if (this.isServiceOrNonStockProduct(product)) return false;
    return Number(product.stocks?.length ?? 0) > 0;
  }

  private isServiceOrNonStockProduct(product: { name?: string | null; category?: { name?: string | null } | null; variants?: { name?: string | null; model?: string | null }[] }) {
    const variantText = (product.variants ?? []).map((variant) => `${variant.name ?? ""} ${variant.model ?? ""}`).join(" ").toLowerCase();
    return /non stock|non-stock|sans suivi|service non stock|produit non stock|plat \/ service/.test(variantText);
  }
}

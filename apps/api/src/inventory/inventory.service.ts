import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, PhysicalInventoryStatus, Prisma, StockAlertStatus, StockAlertType, TransferStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { CreateTransferDto } from "./dto/create-transfer.dto";

type InventoryQuery = { q?: string; dateFrom?: string; dateTo?: string; storeId?: string; warehouseId?: string; categoryId?: string; page?: number; limit?: number };
type PhysicalInventoryDto = { warehouseId: string; storeId?: string; notes?: string; items: Array<{ productId: string; physicalQty: number; barcode?: string; notes?: string }> };
type AdjustmentDto = { productId: string; warehouseId: string; quantity: number; mode: "IN" | "OUT" | "SET"; reason: string; reference?: string };

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly stock: StockService) {}

  async dashboard(tenantId: string, query: InventoryQuery = {}) {
    await this.refreshAlerts(tenantId);
    const whereStock: Prisma.StockWhereInput = { tenantId, warehouseId: query.warehouseId, warehouse: query.storeId ? { storeId: query.storeId } : undefined, product: query.categoryId ? { categoryId: query.categoryId } : undefined };
    const [stocks, productsCount, movements, alerts, expiringSoon, expired] = await Promise.all([
      this.prisma.stock.findMany({ where: whereStock, include: { product: true, warehouse: { include: { store: true } } }, orderBy: { updatedAt: "desc" }, take: 500 }),
      this.prisma.product.count({ where: { tenantId, categoryId: query.categoryId } }),
      this.prisma.inventoryMovement.findMany({ where: { tenantId, warehouseId: query.warehouseId, storeId: query.storeId, createdAt: this.dateFilter(query.dateFrom, query.dateTo) }, include: { product: true, warehouse: { include: { store: true } } }, take: 10, orderBy: { createdAt: "desc" } }),
      this.prisma.stockAlert.findMany({ where: { tenantId, status: StockAlertStatus.OPEN }, orderBy: { createdAt: "desc" }, take: 20 }),
      this.prisma.product.count({ where: { tenantId, expirationDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } } }),
      this.prisma.product.count({ where: { tenantId, expirationDate: { lt: new Date() } } })
    ]);
    const totalStockValue = stocks.reduce((sum, stock) => sum + Number(stock.quantity) * Number(stock.product.averageCost || stock.product.purchasePrice || 0), 0);
    const outOfStock = stocks.filter((stock) => stock.quantity <= 0).length;
    const belowMinimum = stocks.filter((stock) => stock.quantity > 0 && stock.quantity <= stock.minimumStock).length;
    return { totalStockValue, productsCount, stockLines: stocks.length, outOfStock, belowMinimum, expiringSoon, expired, alerts, movements, chart: stocks.slice(0, 10).map((stock) => ({ name: stock.product.name, quantity: stock.quantity, minimum: stock.minimumStock })) };
  }

  async movements(tenantId: string, query: InventoryQuery = {}) {
    const page = Number(query.page ?? 1); const limit = Math.min(Number(query.limit ?? 50), 200);
    const where: Prisma.InventoryMovementWhereInput = { tenantId, warehouseId: query.warehouseId, storeId: query.storeId, createdAt: this.dateFilter(query.dateFrom, query.dateTo), product: query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { sku: { contains: query.q, mode: "insensitive" } }, { barcodes: { some: { value: { contains: query.q } } } }] } : undefined };
    const [items, total] = await Promise.all([this.prisma.inventoryMovement.findMany({ where, include: { product: true, warehouse: { include: { store: true } } }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }), this.prisma.inventoryMovement.count({ where })]);
    return { items, meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  alerts(tenantId: string) { return this.prisma.stockAlert.findMany({ where: { tenantId, status: StockAlertStatus.OPEN }, orderBy: { createdAt: "desc" }, take: 100 }); }

  transfers(tenantId: string) { return this.prisma.transfer.findMany({ where: { tenantId }, include: { fromWarehouse: { include: { store: true } }, toWarehouse: { include: { store: true } }, items: { include: { product: true } } }, orderBy: { createdAt: "desc" } }); }

  async createTransfer(tenantId: string, dto: CreateTransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) throw new BadRequestException("Les depots doivent etre differents");
    const transfer = await this.prisma.transfer.create({ data: { tenantId, fromWarehouseId: dto.fromWarehouseId, toWarehouseId: dto.toWarehouseId, note: dto.note, status: TransferStatus.SENT, items: { create: dto.items } } });
    for (const item of dto.items) {
      await this.stock.stockOut(tenantId, { productId: item.productId, warehouseId: dto.fromWarehouseId, quantity: item.quantity, reference: transfer.id, note: "Transfert sortant" });
      await this.stock.stockIn(tenantId, { productId: item.productId, warehouseId: dto.toWarehouseId, quantity: item.quantity, reference: transfer.id, note: "Transfert entrant" });
    }
    return this.prisma.transfer.update({ where: { id: transfer.id }, data: { status: TransferStatus.RECEIVED }, include: { fromWarehouse: true, toWarehouse: true, items: { include: { product: true } } } });
  }

  async receiveTransfer(tenantId: string, id: string) { const transfer = await this.prisma.transfer.findFirst({ where: { id, tenantId } }); if (!transfer) throw new NotFoundException("Transfert introuvable"); return this.prisma.transfer.update({ where: { id }, data: { status: TransferStatus.RECEIVED } }); }
  async cancelTransfer(tenantId: string, id: string) { const transfer = await this.prisma.transfer.findFirst({ where: { id, tenantId } }); if (!transfer) throw new NotFoundException("Transfert introuvable"); return this.prisma.transfer.update({ where: { id }, data: { status: TransferStatus.CANCELLED } }); }

  physicalInventories(tenantId: string) { return this.prisma.physicalInventory.findMany({ where: { tenantId }, include: { items: true }, orderBy: { createdAt: "desc" } }); }

  async createPhysicalInventory(tenantId: string, userId: string, dto: PhysicalInventoryDto) {
    const number = `INV-${Date.now().toString(36).toUpperCase()}`;
    const items = [];
    for (const item of dto.items) {
      const stock = await this.stock.getOrCreateStock(tenantId, item.productId, dto.warehouseId);
      items.push({ productId: item.productId, systemQty: stock.quantity, physicalQty: item.physicalQty, difference: item.physicalQty - stock.quantity, barcode: item.barcode, notes: item.notes });
    }
    return this.prisma.physicalInventory.create({ data: { tenantId, warehouseId: dto.warehouseId, storeId: dto.storeId, number, notes: dto.notes, createdById: userId, items: { create: items } }, include: { items: true } });
  }

  async validatePhysicalInventory(tenantId: string, userId: string, id: string, correct = true) {
    const inventory = await this.prisma.physicalInventory.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!inventory) throw new NotFoundException("Inventaire introuvable");
    if (inventory.status !== PhysicalInventoryStatus.DRAFT) throw new BadRequestException("Inventaire deja traite");
    if (correct) for (const item of inventory.items) await this.stock.adjustTo(tenantId, item.productId, inventory.warehouseId, item.physicalQty, inventory.id, "Inventaire physique valide");
    return this.prisma.physicalInventory.update({ where: { id }, data: { status: PhysicalInventoryStatus.VALIDATED, validatedById: userId, validatedAt: new Date() }, include: { items: true } });
  }

  async cancelPhysicalInventory(tenantId: string, id: string) { const inventory = await this.prisma.physicalInventory.findFirst({ where: { id, tenantId } }); if (!inventory) throw new NotFoundException("Inventaire introuvable"); return this.prisma.physicalInventory.update({ where: { id }, data: { status: PhysicalInventoryStatus.CANCELLED, cancelledAt: new Date() } }); }

  async createAdjustment(tenantId: string, dto: AdjustmentDto) {
    if (dto.mode === "IN") return this.stock.stockIn(tenantId, { productId: dto.productId, warehouseId: dto.warehouseId, quantity: dto.quantity, reference: dto.reference, note: dto.reason });
    if (dto.mode === "OUT") return this.stock.stockOut(tenantId, { productId: dto.productId, warehouseId: dto.warehouseId, quantity: dto.quantity, reference: dto.reference, note: dto.reason });
    return this.stock.adjustTo(tenantId, dto.productId, dto.warehouseId, dto.quantity, dto.reference, dto.reason);
  }

  async scan(tenantId: string, code: string) {
    const product = await this.prisma.product.findFirst({ where: { tenantId, OR: [{ sku: { equals: code, mode: "insensitive" } }, { qrCode: { equals: code, mode: "insensitive" } }, { barcodes: { some: { value: code } } }, { variants: { some: { OR: [{ sku: { equals: code, mode: "insensitive" } }, { barcode: code }] } } }] }, include: { stocks: { include: { warehouse: true } }, barcodes: true, variants: true } });
    if (!product) throw new NotFoundException("Produit introuvable");
    return product;
  }

  async reports(tenantId: string) {
    const movements = await this.prisma.inventoryMovement.groupBy({ by: ["productId", "type"], where: { tenantId }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 20 }).catch(() => []);
    const value = await this.dashboard(tenantId);
    return { stockValue: value.totalStockValue, rotationPrepared: true, mostMoved: movements.slice(0, 10), leastMoved: movements.slice(-10), historyPrepared: true };
  }

  async exportCsv(tenantId: string) { const data = await this.movements(tenantId, { limit: 1000 }); return [["Date", "Type", "Produit", "Depot", "Quantite", "Avant", "Apres", "Motif"], ...data.items.map((m) => [m.createdAt.toISOString(), m.type, m.product.name, m.warehouse.name, m.quantity, m.beforeQty, m.afterQty, m.note ?? m.reason ?? ""])].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"); }
  async exportExcel(tenantId: string) { const data = await this.movements(tenantId, { limit: 1000 }); return `<table><thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Depot</th><th>Quantite</th><th>Avant</th><th>Apres</th></tr></thead><tbody>${data.items.map((m) => `<tr><td>${m.createdAt.toISOString()}</td><td>${m.type}</td><td>${m.product.name}</td><td>${m.warehouse.name}</td><td>${m.quantity}</td><td>${m.beforeQty}</td><td>${m.afterQty}</td></tr>`).join("")}</tbody></table>`; }
  async exportPdf(tenantId: string) { const report = await this.reports(tenantId); return `Rapport inventaire VTA Commerce\nValeur stock: ${report.stockValue}\nMouvements analyses: ${report.mostMoved.length}`; }

  private async refreshAlerts(tenantId: string) {
    const stocks = await this.prisma.stock.findMany({ where: { tenantId }, include: { product: true, warehouse: { include: { store: true } } }, take: 1000 });
    for (const stock of stocks) {
      if (stock.quantity <= 0) await this.upsertAlert(tenantId, stock.productId, stock.warehouseId, stock.warehouse.storeId ?? undefined, StockAlertType.OUT_OF_STOCK, `Rupture de stock: ${stock.product.name}`, stock.quantity, stock.minimumStock);
      else if (stock.quantity <= stock.minimumStock) await this.upsertAlert(tenantId, stock.productId, stock.warehouseId, stock.warehouse.storeId ?? undefined, StockAlertType.LOW_STOCK, `Stock faible: ${stock.product.name}`, stock.quantity, stock.minimumStock);
    }
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiring = await this.prisma.product.findMany({ where: { tenantId, expirationDate: { lte: soon } }, take: 200 });
    for (const product of expiring) await this.upsertAlert(tenantId, product.id, undefined, product.storeId ?? undefined, product.expirationDate && product.expirationDate < new Date() ? StockAlertType.EXPIRED : StockAlertType.EXPIRING_SOON, product.expirationDate && product.expirationDate < new Date() ? `Produit expire: ${product.name}` : `Expiration proche: ${product.name}`, undefined, undefined, product.expirationDate ?? undefined);
  }

  private async upsertAlert(tenantId: string, productId: string, warehouseId: string | undefined, storeId: string | undefined, type: StockAlertType, message: string, quantity?: number, threshold?: number, expiresAt?: Date) {
    const existing = await this.prisma.stockAlert.findFirst({ where: { tenantId, productId, warehouseId, type, status: StockAlertStatus.OPEN } });
    if (existing) return existing;
    return this.prisma.stockAlert.create({ data: { tenantId, productId, warehouseId, storeId, type, message, quantity, threshold, expiresAt } });
  }

  private dateFilter(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined { if (!dateFrom && !dateTo) return undefined; return { gte: dateFrom ? new Date(dateFrom) : undefined, lte: dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined }; }
}


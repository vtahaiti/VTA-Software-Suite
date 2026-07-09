import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StoreStatus, StoreTransferStatus, WarehouseStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type PageQuery = { search?: string; page?: string; limit?: string };

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const [stores, warehouses, stocks, salesByStore] = await Promise.all([
      this.prisma.store.count({ where: { tenantId, status: { not: StoreStatus.CLOSED } } }),
      this.prisma.warehouse.count({ where: { tenantId, status: { not: WarehouseStatus.CLOSED } } }),
      this.prisma.warehouseStock.findMany({ where: { tenantId }, include: { store: true, product: true } }),
      this.prisma.sale.groupBy({ by: ["storeId"], where: { tenantId }, _sum: { total: true }, _count: { id: true } }).catch(() => [])
    ]);
    const stockByStore = Object.values(stocks.reduce<Record<string, { store: string; quantity: number; products: number }>>((acc, stock) => {
      const key = stock.storeId;
      acc[key] ??= { store: stock.store.name, quantity: 0, products: 0 };
      acc[key].quantity += stock.quantity;
      acc[key].products += 1;
      return acc;
    }, {}));
    return { stores, warehouses, stockByStore, salesByStore };
  }

  async findStores(tenantId: string, query: PageQuery) {
    const page = Number(query.page ?? 1); const limit = Number(query.limit ?? 20); const search = query.search;
    const where: Prisma.StoreWhereInput = { tenantId, OR: search ? [{ code: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }, { city: { contains: search, mode: "insensitive" } }] : undefined };
    const [items, total] = await this.prisma.$transaction([this.prisma.store.findMany({ where, include: { warehouses: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), this.prisma.store.count({ where })]);
    return { items, meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async createStore(tenantId: string, dto: any) {
    try { return await this.prisma.store.create({ data: { tenantId, code: dto.code ?? this.code(dto.name), name: dto.name, phone: dto.phone, email: dto.email, country: dto.country, city: dto.city, address: dto.address, status: dto.status ?? StoreStatus.ACTIVE } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Code magasin deja existant"); throw error; }
  }

  async updateStore(tenantId: string, id: string, dto: any) { await this.ensureStore(tenantId, id); return this.prisma.store.update({ where: { id }, data: dto }); }
  async closeStore(tenantId: string, id: string) { await this.ensureStore(tenantId, id); return this.prisma.store.update({ where: { id }, data: { status: StoreStatus.CLOSED } }); }

  async findWarehouses(tenantId: string, query: PageQuery) {
    const page = Number(query.page ?? 1); const limit = Number(query.limit ?? 20); const search = query.search;
    const where: Prisma.WarehouseWhereInput = { tenantId, OR: search ? [{ code: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] : undefined };
    const [items, total] = await this.prisma.$transaction([this.prisma.warehouse.findMany({ where, include: { store: true, warehouseStocks: { include: { product: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), this.prisma.warehouse.count({ where })]);
    return { items, meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async createWarehouse(tenantId: string, dto: any) {
    await this.ensureStore(tenantId, dto.storeId);
    try { return await this.prisma.warehouse.create({ data: { tenantId, storeId: dto.storeId, code: dto.code ?? this.code(dto.name), name: dto.name, description: dto.description, address: dto.address, status: dto.status ?? WarehouseStatus.ACTIVE, isActive: dto.status !== WarehouseStatus.INACTIVE } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Code depot deja existant"); throw error; }
  }

  async updateWarehouse(tenantId: string, id: string, dto: any) { await this.ensureWarehouse(tenantId, id); return this.prisma.warehouse.update({ where: { id }, data: dto }); }

  async stock(tenantId: string) {
    const rows = await this.prisma.warehouseStock.findMany({ where: { tenantId }, include: { store: true, warehouse: true, product: true }, orderBy: { updatedAt: "desc" } });
    const total = rows.reduce((sum, row) => sum + row.quantity, 0);
    return { total, items: rows };
  }

  async transfers(tenantId: string) { return this.prisma.storeTransfer.findMany({ where: { tenantId }, include: { fromStore: true, toStore: true, fromWarehouse: true, toWarehouse: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" } }); }

  async createTransfer(tenantId: string, userId: string, dto: any) {
    if (dto.fromStoreId === dto.toStoreId) throw new BadRequestException("Les magasins source et destination doivent etre differents");
    await Promise.all([this.ensureStore(tenantId, dto.fromStoreId), this.ensureStore(tenantId, dto.toStoreId), this.ensureWarehouse(tenantId, dto.fromWarehouseId), this.ensureWarehouse(tenantId, dto.toWarehouseId)]);
    return this.prisma.storeTransfer.create({ data: { tenantId, fromStoreId: dto.fromStoreId, toStoreId: dto.toStoreId, fromWarehouseId: dto.fromWarehouseId, toWarehouseId: dto.toWarehouseId, createdById: userId, note: dto.note, items: { create: (dto.items ?? []).map((item: any) => ({ productId: item.productId, quantity: Number(item.quantity) })) } }, include: { items: true, fromStore: true, toStore: true } });
  }

  async validateTransfer(tenantId: string, id: string, userId: string) {
    const transfer = await this.prisma.storeTransfer.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!transfer) throw new NotFoundException("Transfert introuvable");
    if (transfer.status !== StoreTransferStatus.DRAFT) throw new BadRequestException("Transfert deja traite");
    return this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const source = await tx.warehouseStock.findUnique({ where: { tenantId_warehouseId_productId: { tenantId, warehouseId: transfer.fromWarehouseId, productId: item.productId } } });
        if (source && source.quantity < item.quantity) throw new BadRequestException("Stock insuffisant pour le transfert");
        if (source) await tx.warehouseStock.update({ where: { id: source.id }, data: { quantity: { decrement: item.quantity } } });
        await tx.warehouseStock.upsert({ where: { tenantId_warehouseId_productId: { tenantId, warehouseId: transfer.toWarehouseId, productId: item.productId } }, update: { quantity: { increment: item.quantity } }, create: { tenantId, storeId: transfer.toStoreId, warehouseId: transfer.toWarehouseId, productId: item.productId, quantity: item.quantity } });
      }
      return tx.storeTransfer.update({ where: { id }, data: { status: StoreTransferStatus.VALIDATED, validatedById: userId, validatedAt: new Date() }, include: { items: true, fromStore: true, toStore: true } });
    });
  }

  private async ensureStore(tenantId: string, id: string) { const item = await this.prisma.store.findFirst({ where: { id, tenantId } }); if (!item) throw new NotFoundException("Magasin introuvable"); return item; }
  private async ensureWarehouse(tenantId: string, id: string) { const item = await this.prisma.warehouse.findFirst({ where: { id, tenantId } }); if (!item) throw new NotFoundException("Depot introuvable"); return item; }
  private code(value: string) { return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 24); }
}
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, ManufacturingOrderStatus, Prisma, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AddManufacturingMaterialDto, CreateManufacturingOrderDto, ManufacturingQueryDto, UpdateManufacturingOrderDto } from "./dto/manufacturing.dto";

const orderInclude = {
  customer: true,
  warehouse: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  proforma: { include: { payments: true } },
  items: { include: { proformaItem: { include: { product: true } } } },
  materials: { include: { product: { include: { unit: true, stocks: true } }, warehouse: true, manufacturingItem: true } }
} as const;

@Injectable()
export class ManufacturingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: ManufacturingQueryDto) {
    const createdAt = query.dateFrom || query.dateTo ? { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(`${query.dateTo}T23:59:59.999Z`) : undefined } : undefined;
    const where: Prisma.ManufacturingOrderWhereInput = {
      tenantId,
      status: query.status,
      assignedToId: query.assignedToId,
      createdAt,
      OR: query.search ? [
        { manufacturingNumber: { contains: query.search, mode: "insensitive" } },
        { title: { contains: query.search, mode: "insensitive" } },
        { customer: { displayName: { contains: query.search, mode: "insensitive" } } }
      ] : undefined
    };
    const items = await this.prisma.manufacturingOrder.findMany({ where, include: orderInclude, orderBy: [{ expectedDate: "asc" }, { createdAt: "desc" }] });
    return items.map((item) => this.serialize(item));
  }

  async summary(tenantId: string) {
    const now = new Date();
    const [toPrepare, inProduction, ready, overdue] = await this.prisma.$transaction([
      this.prisma.manufacturingOrder.count({ where: { tenantId, status: ManufacturingOrderStatus.TO_PREPARE } }),
      this.prisma.manufacturingOrder.count({ where: { tenantId, status: ManufacturingOrderStatus.IN_PRODUCTION } }),
      this.prisma.manufacturingOrder.count({ where: { tenantId, status: ManufacturingOrderStatus.READY } }),
      this.prisma.manufacturingOrder.count({ where: { tenantId, expectedDate: { lt: now }, status: { in: [ManufacturingOrderStatus.TO_PREPARE, ManufacturingOrderStatus.IN_PRODUCTION] } } })
    ]);
    return { toPrepare, inProduction, ready, overdue };
  }

  assignees(tenantId: string) {
    return this.prisma.user.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.manufacturingOrder.findFirst({ where: { id, tenantId }, include: orderInclude });
    if (!order) throw new NotFoundException("Fabrication introuvable");
    return this.serialize(order);
  }

  async findByProforma(tenantId: string, proformaId: string) {
    const order = await this.prisma.manufacturingOrder.findFirst({ where: { tenantId, proformaId }, include: orderInclude });
    return order ? this.serialize(order) : null;
  }

  async createFromProforma(tenantId: string, proformaId: string, dto: CreateManufacturingOrderDto, createdById?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { businessProfileType: true } });
    if (tenant?.businessProfileType !== "windows-aluminium") throw new BadRequestException("La fabrication client est réservée au profil Fabrication fenêtres/portes.");
    const existing = await this.prisma.manufacturingOrder.findFirst({ where: { tenantId, proformaId }, include: orderInclude });
    if (existing) return this.serialize(existing);
    await this.assertWarehouse(tenantId, dto.warehouseId);
    if (dto.assignedToId) await this.assertAssignee(tenantId, dto.assignedToId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:manufacturing-number`}))`;
      const duplicate = await tx.manufacturingOrder.findFirst({ where: { tenantId, proformaId }, include: orderInclude });
      if (duplicate) return this.serialize(duplicate);
      const proforma = await tx.proforma.findFirst({ where: { id: proformaId, tenantId }, include: { customer: true, items: { include: { product: true } } } });
      if (!proforma) throw new NotFoundException("Commande introuvable");
      if (proforma.status === SalesDocumentStatus.CANCELLED || proforma.status === SalesDocumentStatus.COMPLETED) throw new BadRequestException("Cette commande ne peut pas être lancée en fabrication.");
      const manufacturingNumber = await this.nextNumber(tx, tenantId);
      const order = await tx.manufacturingOrder.create({
        data: {
          tenantId,
          manufacturingNumber,
          proformaId,
          customerId: proforma.customerId,
          warehouseId: dto.warehouseId,
          title: proforma.title?.trim() || `Commande ${proforma.documentNumber}`,
          priority: dto.priority,
          expectedDate: proforma.expectedDate,
          assignedToId: dto.assignedToId,
          instructions: dto.instructions ?? proforma.notes,
          createdById,
          items: { create: proforma.items.map((item) => ({
            proformaItemId: item.id,
            description: item.product?.name ?? item.customName ?? "Ouvrage sur mesure",
            quantity: item.quantity,
            ...this.parseFabricationNote(item.customNote)
          })) }
        },
        include: orderInclude
      });
      return this.serialize(order);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateManufacturingOrderDto) {
    const order = await this.requireOrder(tenantId, id);
    if (order.status === ManufacturingOrderStatus.COMPLETED || order.status === ManufacturingOrderStatus.CANCELLED) throw new BadRequestException("Cette fabrication est clôturée.");
    if (dto.assignedToId) await this.assertAssignee(tenantId, dto.assignedToId);
    return this.serialize(await this.prisma.manufacturingOrder.update({
      where: { id },
      data: { assignedToId: dto.assignedToId, priority: dto.priority, expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined, instructions: dto.instructions, notes: dto.notes },
      include: orderInclude
    }));
  }

  async addMaterial(tenantId: string, id: string, dto: AddManufacturingMaterialDto) {
    const order = await this.requireOrder(tenantId, id);
    if (order.status !== ManufacturingOrderStatus.DRAFT && order.status !== ManufacturingOrderStatus.TO_PREPARE) throw new BadRequestException("Les matières ne peuvent plus être modifiées après le lancement.");
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, tenantId, isActive: true }, include: { unit: true } });
    if (!product) throw new NotFoundException("Matière introuvable");
    if (dto.manufacturingItemId && !order.items.some((item) => item.id === dto.manufacturingItemId)) throw new NotFoundException("Ouvrage introuvable dans cette fabrication");
    await this.prisma.manufacturingMaterial.create({ data: {
      manufacturingOrderId: id,
      manufacturingItemId: dto.manufacturingItemId,
      productId: product.id,
      warehouseId: order.warehouseId,
      requiredQuantity: dto.requiredQuantity,
      unit: dto.unit?.trim() || product.unit?.symbol || product.unit?.name || "unité",
      unitCost: dto.unitCost ?? Number(product.averageCost || product.purchasePrice || 0),
      notes: dto.notes
    } });
    return this.findOne(tenantId, id);
  }

  async removeMaterial(tenantId: string, id: string, materialId: string) {
    const order = await this.requireOrder(tenantId, id);
    if (order.status !== ManufacturingOrderStatus.DRAFT && order.status !== ManufacturingOrderStatus.TO_PREPARE) throw new BadRequestException("Les matières ne peuvent plus être modifiées après le lancement.");
    const material = order.materials.find((item) => item.id === materialId);
    if (!material) throw new NotFoundException("Matière introuvable");
    if (Number(material.reservedQuantity) > 0) throw new BadRequestException("Libérez ou annulez la réservation avant de retirer cette matière.");
    await this.prisma.manufacturingMaterial.delete({ where: { id: materialId } });
    return this.findOne(tenantId, id);
  }

  async reserve(tenantId: string, id: string, userId?: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, tenantId, id);
      const order = await tx.manufacturingOrder.findFirst({ where: { id, tenantId }, include: { materials: true } });
      if (!order) throw new NotFoundException("Fabrication introuvable");
      if (order.status !== ManufacturingOrderStatus.DRAFT && order.status !== ManufacturingOrderStatus.TO_PREPARE) return;
      if (!order.materials.length) throw new BadRequestException("Ajoutez au moins une matière avant de réserver le stock.");
      for (const material of order.materials) {
        const needed = Number(material.requiredQuantity) - Number(material.reservedQuantity);
        if (needed <= 0) continue;
        this.assertStockPrecision(needed, material.unit);
        const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: material.productId, warehouseId: material.warehouseId } }, include: { product: true } });
        const available = (stock?.quantity ?? 0) - (stock?.reserved ?? 0);
        if (!stock || available < needed) throw new ConflictException(`Stock insuffisant — ${stock?.product.name ?? "matière"}. Nécessaire : ${needed} ${material.unit}. Disponible : ${available} ${material.unit}.`);
        const changed = await tx.stock.updateMany({ where: { id: stock.id, reserved: { lte: stock.quantity - needed } }, data: { reserved: { increment: needed } } });
        if (!changed.count) throw new ConflictException(`Le stock disponible pour ${stock.product.name} vient de changer. Réessayez.`);
        await tx.manufacturingMaterial.update({ where: { id: material.id }, data: { reservedQuantity: { increment: needed } } });
        await tx.stockReservation.create({ data: { tenantId, proformaId: order.proformaId, productId: material.productId, warehouseId: material.warehouseId, quantity: needed, manufacturingOrderId: order.id, manufacturingMaterialId: material.id, createdById: userId } });
      }
      await tx.manufacturingOrder.update({ where: { id }, data: { status: ManufacturingOrderStatus.TO_PREPARE } });
    });
    return this.findOne(tenantId, id);
  }

  async start(tenantId: string, id: string, userId?: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, tenantId, id);
      const order = await tx.manufacturingOrder.findFirst({ where: { id, tenantId }, include: { materials: { include: { product: true } } } });
      if (!order) throw new NotFoundException("Fabrication introuvable");
      if (order.status === ManufacturingOrderStatus.IN_PRODUCTION) return;
      if (order.status !== ManufacturingOrderStatus.TO_PREPARE) throw new BadRequestException("La fabrication doit être à préparer avant son lancement.");
      if (!order.materials.length) throw new BadRequestException("Ajoutez et réservez les matières avant de lancer la fabrication.");
      for (const material of order.materials) {
        const quantity = Number(material.requiredQuantity);
        this.assertStockPrecision(quantity, material.unit);
        if (Number(material.reservedQuantity) < quantity) throw new BadRequestException(`Réservez toute la quantité de ${material.product.name} avant de lancer la fabrication.`);
        const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: material.productId, warehouseId: material.warehouseId } } });
        if (!stock) throw new ConflictException(`Stock introuvable pour ${material.product.name}`);
        const changed = await tx.stock.updateMany({ where: { id: stock.id, quantity: { gte: quantity }, reserved: { gte: quantity } }, data: { quantity: { decrement: quantity }, reserved: { decrement: quantity } } });
        if (!changed.count) throw new ConflictException(`Stock insuffisant — ${material.product.name}. La fabrication n'a pas été lancée.`);
        const updated = await tx.stock.findUniqueOrThrow({ where: { id: stock.id } });
        await tx.manufacturingMaterial.update({ where: { id: material.id }, data: { consumedQuantity: quantity, reservedQuantity: { decrement: quantity } } });
        await tx.stockReservation.updateMany({ where: { manufacturingMaterialId: material.id, deliveredAt: null, releasedAt: null }, data: { deliveredAt: new Date() } });
        await tx.inventoryMovement.create({ data: { tenantId, productId: material.productId, warehouseId: material.warehouseId, type: InventoryMovementType.ADJUSTMENT, userId, quantity, beforeQty: updated.quantity + quantity, afterQty: updated.quantity, reference: order.manufacturingNumber, reason: "Fabrication - matière consommée", note: order.title, manufacturingOrderId: order.id } });
      }
      await tx.manufacturingOrder.update({ where: { id }, data: { status: ManufacturingOrderStatus.IN_PRODUCTION, startedAt: new Date() } });
      await tx.proforma.updateMany({ where: { id: order.proformaId, tenantId, status: { in: [SalesDocumentStatus.CONFIRMED, SalesDocumentStatus.IN_PROGRESS] } }, data: { status: SalesDocumentStatus.IN_PROGRESS } });
    });
    return this.findOne(tenantId, id);
  }

  async ready(tenantId: string, id: string) {
    const order = await this.requireOrder(tenantId, id);
    if (order.status === ManufacturingOrderStatus.READY) return this.findOne(tenantId, id);
    if (order.status !== ManufacturingOrderStatus.IN_PRODUCTION) throw new BadRequestException("La fabrication doit être en cours avant d'être marquée prête.");
    await this.prisma.$transaction([
      this.prisma.manufacturingOrder.update({ where: { id }, data: { status: ManufacturingOrderStatus.READY } }),
      this.prisma.proforma.updateMany({ where: { id: order.proformaId, tenantId }, data: { status: SalesDocumentStatus.READY } })
    ]);
    return this.findOne(tenantId, id);
  }

  async cancel(tenantId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, tenantId, id);
      const order = await tx.manufacturingOrder.findFirst({ where: { id, tenantId }, include: { materials: true } });
      if (!order) throw new NotFoundException("Fabrication introuvable");
      if (order.status === ManufacturingOrderStatus.CANCELLED) return;
      if (order.status === ManufacturingOrderStatus.IN_PRODUCTION || order.status === ManufacturingOrderStatus.READY || order.status === ManufacturingOrderStatus.COMPLETED) throw new BadRequestException("Une fabrication déjà lancée ne peut pas être annulée automatiquement.");
      for (const material of order.materials) {
        const reserved = Number(material.reservedQuantity);
        if (reserved <= 0) continue;
        this.assertStockPrecision(reserved, material.unit);
        await tx.stock.updateMany({ where: { tenantId, productId: material.productId, warehouseId: material.warehouseId, reserved: { gte: reserved } }, data: { reserved: { decrement: reserved } } });
        await tx.manufacturingMaterial.update({ where: { id: material.id }, data: { reservedQuantity: 0 } });
      }
      await tx.stockReservation.updateMany({ where: { manufacturingOrderId: id, releasedAt: null, deliveredAt: null }, data: { releasedAt: new Date() } });
      await tx.manufacturingOrder.update({ where: { id }, data: { status: ManufacturingOrderStatus.CANCELLED } });
    });
    return this.findOne(tenantId, id);
  }

  async completeForDeliveredProforma(tx: Prisma.TransactionClient, tenantId: string, proformaId: string) {
    await tx.manufacturingOrder.updateMany({ where: { tenantId, proformaId, status: ManufacturingOrderStatus.READY }, data: { status: ManufacturingOrderStatus.COMPLETED, completedAt: new Date() } });
  }

  private async requireOrder(tenantId: string, id: string) {
    const order = await this.prisma.manufacturingOrder.findFirst({ where: { id, tenantId }, include: { items: true, materials: true } });
    if (!order) throw new NotFoundException("Fabrication introuvable");
    return order;
  }

  private async assertWarehouse(tenantId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true } });
    if (!warehouse) throw new NotFoundException("Dépôt introuvable");
  }

  private async assertAssignee(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId, isActive: true } });
    if (!user) throw new NotFoundException("Responsable introuvable");
  }

  private async lockOrder(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ManufacturingOrder" WHERE "id" = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException("Fabrication introuvable");
  }

  private async nextNumber(tx: Prisma.TransactionClient, tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `FAB-${year}-`;
    const last = await tx.manufacturingOrder.findFirst({ where: { tenantId, manufacturingNumber: { startsWith: prefix } }, orderBy: { manufacturingNumber: "desc" }, select: { manufacturingNumber: true } });
    const next = Number(last?.manufacturingNumber.slice(prefix.length) ?? 0) + 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  private parseFabricationNote(note?: string | null) {
    const parts = String(note ?? "").split("·").map((part) => part.trim()).filter(Boolean);
    const dimensionIndex = parts.findIndex((part) => /^\??\d+(?:[.,]\d+)?x\??\d+/i.test(part));
    const dimensions = dimensionIndex >= 0 ? parts[dimensionIndex].replace(/cm$/i, "").split("x") : [];
    const number = (value?: string) => value && value !== "?" ? Number(value.replace(",", ".")) : undefined;
    return {
      workType: parts[0] || undefined,
      material: parts[1] || undefined,
      width: number(dimensions[0]?.replace("?", "")),
      height: number(dimensions[1]?.replace("?", "")),
      length: number(dimensions[2]?.replace("?", "")),
      color: dimensionIndex >= 0 ? parts[dimensionIndex + 1] : undefined,
      glassType: parts.find((part) => part.toLowerCase().startsWith("verre "))?.replace(/^verre\s+/i, ""),
      instructions: note || undefined
    };
  }

  private assertStockPrecision(quantity: number, unit: string) {
    if (!Number.isInteger(quantity)) throw new BadRequestException(`Le stock actuel de cette matière est suivi en unités entières. Configurez ${unit} comme unité de base entière (ex. centimètres) avant de réserver ${quantity}.`);
  }

  private serialize<T extends { materials?: Array<{ requiredQuantity: unknown; reservedQuantity: unknown; consumedQuantity: unknown; wasteQuantity: unknown; unitCost: unknown; product?: unknown; warehouse?: unknown }> }>(order: T) {
    return {
      ...order,
      materials: order.materials?.map((material) => {
        const product = material.product as { stocks?: Array<{ warehouseId: string; quantity: number; reserved: number }> } | undefined;
        const warehouseId = String((material as { warehouseId?: unknown }).warehouseId ?? "");
        const stock = product?.stocks?.find((item) => String((item as { warehouseId?: unknown }).warehouseId ?? "") === warehouseId) ?? product?.stocks?.[0];
        return { ...material, availableQuantity: stock ? stock.quantity - stock.reserved : undefined };
      })
    };
  }
}

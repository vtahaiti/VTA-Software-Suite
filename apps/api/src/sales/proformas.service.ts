import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, Prisma, SalesDocumentPaymentStatus, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvoicePaymentDto, CreateSalesDocumentDto, SalesDocumentQueryDto, UpdateSalesDocumentDto } from "./dto/sales-document.dto";
import { calculateDocumentTotals, ensureCustomer, ensureProducts, generateDocumentNumber, mapDocumentItems, withDocumentNumber, withDocumentNumbers } from "./sales-documents.util";

type SalesDocumentLine = {
  productId?: string | null;
  customName?: string | null;
  customType?: string | null;
  customNote?: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
};

type Transaction = Prisma.TransactionClient;

const operationalStatuses: SalesDocumentStatus[] = [
  SalesDocumentStatus.DRAFT,
  SalesDocumentStatus.CONFIRMED,
  SalesDocumentStatus.IN_PROGRESS,
  SalesDocumentStatus.READY,
  SalesDocumentStatus.DELIVERED,
  SalesDocumentStatus.COMPLETED,
  SalesDocumentStatus.CANCELLED
];

@Injectable()
export class ProformasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: SalesDocumentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProformaWhereInput = {
      tenantId,
      status: query.status as SalesDocumentStatus,
      paymentStatus: query.paymentStatus as SalesDocumentPaymentStatus,
      OR: query.search
        ? [
            { documentNumber: { contains: query.search, mode: "insensitive" } },
            { customer: { displayName: { contains: query.search, mode: "insensitive" } } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.proforma.findMany({
        where,
        include: { customer: true, quote: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.proforma.count({ where })
    ]);
    return { items: withDocumentNumbers(items), meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async findOne(tenantId: string, id: string) {
    const proforma = await this.prisma.proforma.findFirst({
      where: { id, tenantId },
      include: { customer: true, quote: true, warehouse: true, items: { include: { product: true } }, invoices: true, payments: true, stockReservations: true }
    });
    if (!proforma) throw new NotFoundException("Commande introuvable");
    return withDocumentNumber({ ...proforma, customerHistoryPrepared: true, stockUpdatePrepared: false, printFormats: ["A4_LETTER"] });
  }

  async create(tenantId: string, dto: CreateSalesDocumentDto, createdById?: string) {
    await ensureCustomer(this.prisma, tenantId, dto.customerId);
    await ensureProducts(this.prisma, tenantId, dto.items.map((item) => item.productId).filter((productId): productId is string => Boolean(productId)));
    const warehouse = await this.resolveWarehouse(this.prisma, tenantId, dto.warehouseId);
    const totals = calculateDocumentTotals(dto.items, dto.discount ?? 0);
    return withDocumentNumber(await this.prisma.proforma.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        warehouseId: warehouse?.id,
        documentNumber: generateDocumentNumber("CMD"),
        status: SalesDocumentStatus.DRAFT,
        paymentStatus: SalesDocumentPaymentStatus.UNPAID,
        notes: dto.notes,
        customerSnapshot: dto.customerId ? await this.customerSnapshot(tenantId, dto.customerId) : undefined,
        companySnapshot: await this.companySnapshot(tenantId),
        createdById,
        ...totals,
        items: { create: mapDocumentItems(dto.items) }
      },
      include: { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true }
    }));
  }

  async update(tenantId: string, id: string, dto: UpdateSalesDocumentDto) {
    const proforma = await this.findOne(tenantId, id);
    if (proforma.status !== SalesDocumentStatus.DRAFT) {
      throw new BadRequestException("Une commande confirmée ne peut plus être modifiée directement. Annulez ou dupliquez-la.");
    }
    await ensureCustomer(this.prisma, tenantId, dto.customerId);
    await ensureProducts(this.prisma, tenantId, dto.items.map((item) => item.productId).filter((productId): productId is string => Boolean(productId)));
    const warehouse = await this.resolveWarehouse(this.prisma, tenantId, dto.warehouseId ?? proforma.warehouseId ?? undefined);
    const totals = calculateDocumentTotals(dto.items, dto.discount ?? 0);
    return withDocumentNumber(await this.prisma.proforma.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        warehouseId: warehouse?.id,
        notes: dto.notes,
        customerSnapshot: dto.customerId ? await this.customerSnapshot(tenantId, dto.customerId) : undefined,
        companySnapshot: await this.companySnapshot(tenantId),
        ...totals,
        items: { deleteMany: {}, create: mapDocumentItems(dto.items) }
      },
      include: { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true }
    }));
  }

  async convertToInvoice(tenantId: string, id: string, createdById?: string) {
    const proforma = await this.findOne(tenantId, id);
    if (([SalesDocumentStatus.CANCELLED, SalesDocumentStatus.CONVERTED] as SalesDocumentStatus[]).includes(proforma.status)) {
      throw new BadRequestException("Cette commande ne peut pas être transformée");
    }
    const lines = proforma.items as SalesDocumentLine[];
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        customerId: proforma.customerId,
        proformaId: proforma.id,
        documentNumber: generateDocumentNumber("INV"),
        status: SalesDocumentStatus.SENT,
        subtotal: proforma.subtotal,
        discount: proforma.discount,
        tax: proforma.tax,
        total: proforma.total,
        paidAmount: proforma.paidAmount,
        balance: proforma.balance,
        notes: proforma.notes,
        createdById,
        issuedAt: new Date(),
        items: { create: lines.map((item) => this.copyLine(item)) }
      },
      include: { customer: true, items: { include: { product: true } } }
    });
    await this.prisma.proforma.update({ where: { id }, data: { status: SalesDocumentStatus.CONVERTED } });
    return withDocumentNumber(invoice);
  }

  async updateStatus(tenantId: string, id: string, status: SalesDocumentStatus, userId?: string) {
    if (!operationalStatuses.includes(status)) throw new BadRequestException("Statut de commande invalide");
    return this.prisma.$transaction(async (tx) => {
      const proforma = await this.findOneInTransaction(tx, tenantId, id);
      if (status === SalesDocumentStatus.CONFIRMED) return this.confirmOrder(tx, tenantId, proforma, userId);
      if (status === SalesDocumentStatus.DELIVERED) return this.deliverOrder(tx, tenantId, proforma, userId);
      if (status === SalesDocumentStatus.CANCELLED) return this.cancelOrder(tx, tenantId, proforma);
      if (status === SalesDocumentStatus.COMPLETED) return this.completeOrder(tx, proforma);
      this.ensureForwardOperationalTransition(proforma.status, status);
      return withDocumentNumber(await tx.proforma.update({
        where: { id },
        data: { status },
        include: { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true }
      }));
    });
  }

  async registerPayment(tenantId: string, id: string, dto: CreateInvoicePaymentDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const proforma = await this.findOneInTransaction(tx, tenantId, id);
      if (proforma.status === SalesDocumentStatus.DRAFT) throw new BadRequestException("Confirmez la commande avant d'enregistrer une avance.");
      if (proforma.status === SalesDocumentStatus.CANCELLED) throw new BadRequestException("Commande annulée");
      if (Number(proforma.balance) <= 0) throw new BadRequestException("Commande déjà soldée");
      if (dto.amount > Number(proforma.balance)) throw new BadRequestException("Paiement supérieur à la balance");

      const paidAmount = Number(proforma.paidAmount) + dto.amount;
      const balance = Number(proforma.total) - paidAmount;
      const paymentStatus = balance <= 0 ? SalesDocumentPaymentStatus.PAID : SalesDocumentPaymentStatus.PARTIALLY_PAID;
      await tx.payment.create({ data: { proformaId: id, method: dto.method, amount: dto.amount, reference: dto.reference, notes: dto.notes, createdById: userId } });
      return withDocumentNumber(await tx.proforma.update({
        where: { id },
        data: { paidAmount, balance, paymentStatus },
        include: { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true }
      }));
    });
  }

  async summary(tenantId: string) {
    const active = [SalesDocumentStatus.CONFIRMED, SalesDocumentStatus.IN_PROGRESS, SalesDocumentStatus.READY, SalesDocumentStatus.DELIVERED];
    const [inProgress, readyUnpaid, completed, payments, balances] = await this.prisma.$transaction([
      this.prisma.proforma.count({ where: { tenantId, status: { in: active } } }),
      this.prisma.proforma.count({ where: { tenantId, status: SalesDocumentStatus.READY, balance: { gt: 0 } } }),
      this.prisma.proforma.count({ where: { tenantId, status: SalesDocumentStatus.COMPLETED } }),
      this.prisma.payment.aggregate({ where: { proforma: { tenantId } }, _sum: { amount: true } }),
      this.prisma.proforma.aggregate({ where: { tenantId, status: { notIn: [SalesDocumentStatus.CANCELLED, SalesDocumentStatus.CONVERTED] }, balance: { gt: 0 } }, _sum: { balance: true } })
    ]);
    return {
      ordersInProgress: inProgress,
      depositsReceived: Number(payments._sum.amount ?? 0),
      balancesToCollect: Number(balances._sum.balance ?? 0),
      readyUnpaidOrders: readyUnpaid,
      completedOrders: completed
    };
  }

  private async confirmOrder(tx: Transaction, tenantId: string, proforma: Awaited<ReturnType<ProformasService["findOneInTransaction"]>>, userId?: string) {
    if (proforma.status !== SalesDocumentStatus.DRAFT && proforma.status !== SalesDocumentStatus.CONFIRMED) {
      throw new BadRequestException("Seule une commande brouillon peut être confirmée.");
    }
    const activeReservations = proforma.stockReservations.filter((reservation) => !reservation.releasedAt && !reservation.deliveredAt);
    if (proforma.status === SalesDocumentStatus.CONFIRMED && activeReservations.length > 0) return withDocumentNumber(proforma);
    for (const item of proforma.items) {
      if (!item.productId) continue;
      await this.reserveProductLine(tx, tenantId, proforma.id, proforma.warehouseId ?? undefined, item.productId, Number(item.quantity), userId);
    }
    return withDocumentNumber(await tx.proforma.update({
      where: { id: proforma.id },
      data: { status: SalesDocumentStatus.CONFIRMED, reservedAt: new Date() },
      include: { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true }
    }));
  }

  private async deliverOrder(tx: Transaction, tenantId: string, proforma: Awaited<ReturnType<ProformasService["findOneInTransaction"]>>, userId?: string) {
    if (!([SalesDocumentStatus.CONFIRMED, SalesDocumentStatus.IN_PROGRESS, SalesDocumentStatus.READY, SalesDocumentStatus.DELIVERED] as SalesDocumentStatus[]).includes(proforma.status)) {
      throw new BadRequestException("Confirmez la commande avant livraison.");
    }
    if (proforma.status === SalesDocumentStatus.DELIVERED) return withDocumentNumber(proforma);
    const reservations = proforma.stockReservations.filter((reservation) => !reservation.releasedAt && !reservation.deliveredAt);
    for (const reservation of reservations) {
      const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: reservation.productId, warehouseId: reservation.warehouseId } } });
      if (!stock) throw new ConflictException("Stock réservé introuvable pour la livraison.");
      if (stock.reserved < reservation.quantity || stock.quantity < reservation.quantity) throw new ConflictException("Stock insuffisant pour livrer la commande.");
      const updated = await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: reservation.quantity }, reserved: { decrement: reservation.quantity } }
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
          type: InventoryMovementType.ORDER_DELIVERY,
          userId,
          quantity: reservation.quantity,
          beforeQty: stock.quantity,
          afterQty: updated.quantity,
          reference: proforma.id,
          reason: "Livraison commande",
          note: proforma.documentNumber
        }
      });
      await tx.stockReservation.update({ where: { id: reservation.id }, data: { deliveredAt: new Date() } });
    }
    return withDocumentNumber(await tx.proforma.update({
      where: { id: proforma.id },
      data: { status: SalesDocumentStatus.DELIVERED, deliveredAt: new Date() },
      include: { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true }
    }));
  }

  private async cancelOrder(tx: Transaction, tenantId: string, proforma: Awaited<ReturnType<ProformasService["findOneInTransaction"]>>) {
    if (([SalesDocumentStatus.DELIVERED, SalesDocumentStatus.COMPLETED] as SalesDocumentStatus[]).includes(proforma.status)) {
      throw new BadRequestException("Une commande livrée ne peut pas être annulée simplement.");
    }
    if (proforma.status === SalesDocumentStatus.CANCELLED) return withDocumentNumber(proforma);
    await this.releaseReservations(tx, tenantId, proforma);
    return withDocumentNumber(await tx.proforma.update({
      where: { id: proforma.id },
      data: { status: SalesDocumentStatus.CANCELLED, cancelledAt: new Date() },
      include: { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true }
    }));
  }

  private async completeOrder(tx: Transaction, proforma: Awaited<ReturnType<ProformasService["findOneInTransaction"]>>) {
    if (proforma.status !== SalesDocumentStatus.DELIVERED) throw new BadRequestException("La commande doit être livrée avant d'être terminée.");
    if (Number(proforma.balance) > 0) throw new BadRequestException("La balance doit être réglée avant de terminer la commande.");
    return withDocumentNumber(await tx.proforma.update({
      where: { id: proforma.id },
      data: { status: SalesDocumentStatus.COMPLETED, completedAt: new Date() },
      include: { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, stockReservations: true }
    }));
  }

  private async reserveProductLine(tx: Transaction, tenantId: string, proformaId: string, warehouseId: string | undefined, productId: string, quantity: number, userId?: string) {
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId, isActive: true },
      include: { variants: true, stocks: warehouseId ? { where: { warehouseId } } : { orderBy: { updatedAt: "desc" } } }
    });
    if (!product) throw new NotFoundException("Produit introuvable");
    if (!this.isStockTrackedProduct(product)) return;
    const stock = product.stocks[0];
    if (!stock) throw new ConflictException(`Aucun stock disponible pour ${product.name}`);
    const available = stock.quantity - stock.reserved;
    if (available < quantity) throw new ConflictException(`Stock insuffisant pour ${product.name}: ${available} disponible.`);
    const updated = await tx.stock.updateMany({
      where: { id: stock.id, quantity: stock.quantity, reserved: stock.reserved },
      data: { reserved: { increment: quantity } }
    });
    if (updated.count !== 1) throw new ConflictException("Stock modifié pendant la confirmation. Réessayez.");
    await tx.stockReservation.create({ data: { tenantId, proformaId, productId, warehouseId: stock.warehouseId, quantity, createdById: userId } });
  }

  private async releaseReservations(tx: Transaction, tenantId: string, proforma: Awaited<ReturnType<ProformasService["findOneInTransaction"]>>) {
    const reservations = proforma.stockReservations.filter((reservation) => !reservation.releasedAt && !reservation.deliveredAt);
    for (const reservation of reservations) {
      const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: reservation.productId, warehouseId: reservation.warehouseId } } });
      if (stock && stock.reserved >= reservation.quantity) {
        await tx.stock.update({ where: { id: stock.id }, data: { reserved: { decrement: reservation.quantity } } });
      }
      await tx.stockReservation.update({ where: { id: reservation.id }, data: { releasedAt: new Date() } });
    }
  }

  private ensureForwardOperationalTransition(current: SalesDocumentStatus, next: SalesDocumentStatus) {
    const order: SalesDocumentStatus[] = [SalesDocumentStatus.CONFIRMED, SalesDocumentStatus.IN_PROGRESS, SalesDocumentStatus.READY];
    if (current === next) return;
    if (current === SalesDocumentStatus.DRAFT) throw new BadRequestException("Confirmez la commande avant de changer son état.");
    if (([SalesDocumentStatus.CANCELLED, SalesDocumentStatus.COMPLETED, SalesDocumentStatus.DELIVERED] as SalesDocumentStatus[]).includes(current)) {
      throw new BadRequestException("Cette commande ne peut plus changer vers ce statut.");
    }
    if (!order.includes(next)) throw new BadRequestException("Transition de commande invalide.");
    if (order.indexOf(next) < order.indexOf(current)) throw new BadRequestException("Retour de statut non autorisé.");
  }

  private async findOneInTransaction(tx: Transaction, tenantId: string, id: string) {
    const proforma = await tx.proforma.findFirst({
      where: { id, tenantId },
      include: { customer: true, quote: true, warehouse: true, items: { include: { product: true } }, invoices: true, payments: true, stockReservations: true }
    });
    if (!proforma) throw new NotFoundException("Commande introuvable");
    return proforma;
  }

  private async resolveWarehouse(client: PrismaService | Transaction, tenantId: string, warehouseId?: string) {
    if (warehouseId) {
      const warehouse = await client.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true } });
      if (!warehouse) throw new NotFoundException("Dépôt introuvable");
      return warehouse;
    }
    return client.warehouse.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: "asc" } });
  }

  private async customerSnapshot(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    return customer ? { id: customer.id, name: customer.displayName, phone: customer.phone, email: customer.email, address: customer.address } : undefined;
  }

  private async companySnapshot(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, include: { companyProfile: true, logo: true } });
    if (!tenant) return undefined;
    return {
      id: tenant.id,
      name: tenant.companyProfile?.companyName ?? tenant.companyProfile?.name ?? tenant.name,
      phone: tenant.companyProfile?.phone ?? tenant.phone,
      email: tenant.companyProfile?.email ?? tenant.email,
      address: tenant.companyProfile?.address ?? tenant.address,
      logoUrl: tenant.companyProfile?.logoUrl ?? tenant.logo?.url
    };
  }

  private isStockTrackedProduct(product: { minimumStock?: number | null; stocks?: unknown[]; variants?: Array<{ name?: string | null; model?: string | null }> }) {
    const variantText = (product.variants ?? []).map((variant) => `${variant.name ?? ""} ${variant.model ?? ""}`).join(" ").toLowerCase();
    const explicitlyNonStock = /non stock|non-stock|sans suivi|service|plat/.test(variantText);
    if (explicitlyNonStock && Number(product.stocks?.length ?? 0) === 0) return false;
    return Number(product.minimumStock ?? 0) > 0 || Number(product.stocks?.length ?? 0) > 0;
  }

  private copyLine(item: SalesDocumentLine) {
    return {
      productId: item.productId,
      customName: item.customName,
      customType: item.customType,
      customNote: item.customNote,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      total: item.total
    };
  }
}

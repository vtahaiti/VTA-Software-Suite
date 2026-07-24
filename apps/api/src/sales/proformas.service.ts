import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalesDocumentPaymentStatus, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvoicePaymentDto, CreateSalesDocumentDto, SalesDocumentQueryDto, UpdateSalesDocumentStatusDto } from "./dto/sales-document.dto";
import {
  calculateDocumentTotals,
  deductStockForItems,
  ensureCustomer,
  ensureProducts,
  generateDocumentNumber,
  mapDocumentItems,
  restockForItems,
  withDocumentNumber,
  withDocumentNumbers
} from "./sales-documents.util";

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

const documentInclude = { customer: true, warehouse: true, items: { include: { product: true } }, payments: true, invoices: true } as const;

@Injectable()
export class ProformasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: SalesDocumentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProformaWhereInput = {
      tenantId,
      status: query.status as SalesDocumentStatus,
      OR: query.search
        ? [
            { documentNumber: { contains: query.search, mode: "insensitive" } },
            { customer: { displayName: { contains: query.search, mode: "insensitive" } } }
          ]
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.proforma.findMany({ where, include: documentInclude, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.proforma.count({ where })
    ]);
    return { items: withDocumentNumbers(items), meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async findOne(tenantId: string, id: string) {
    const proforma = await this.prisma.proforma.findFirst({ where: { id, tenantId }, include: { ...documentInclude, quote: true } });
    if (!proforma) throw new NotFoundException("Commande introuvable");
    return withDocumentNumber({ ...proforma, printFormats: ["A4_LETTER"] });
  }

  async create(tenantId: string, dto: CreateSalesDocumentDto, createdById?: string) {
    await ensureCustomer(this.prisma, tenantId, dto.customerId);
    await ensureProducts(this.prisma, tenantId, dto.items.map((item) => item.productId).filter((productId): productId is string => Boolean(productId)));
    const totals = calculateDocumentTotals(dto.items, dto.discount ?? 0);
    const documentNumber = generateDocumentNumber("CMD");
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await this.resolveWarehouse(tx, tenantId, dto.warehouseId);
      const proforma = await tx.proforma.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          warehouseId: warehouse?.id,
          documentNumber,
          status: SalesDocumentStatus.CONFIRMED,
          paymentStatus: SalesDocumentPaymentStatus.UNPAID,
          notes: dto.notes,
          customerSnapshot: dto.customerId ? await this.customerSnapshot(tx, tenantId, dto.customerId) : undefined,
          companySnapshot: await this.companySnapshot(tx, tenantId),
          createdById,
          reservedAt: new Date(),
          ...totals,
          items: { create: mapDocumentItems(dto.items) }
        },
        include: { items: true }
      });
      await deductStockForItems(tx, tenantId, warehouse?.id, proforma.items, proforma.id, documentNumber, createdById);
      const refreshed = await tx.proforma.findUniqueOrThrow({ where: { id: proforma.id }, include: documentInclude });
      return withDocumentNumber(refreshed);
    });
  }

  update(): never {
    throw new BadRequestException("Une commande ne peut plus être modifiée après sa création. Annulez-la et recréez-la si besoin.");
  }

  async updateStatus(tenantId: string, id: string, status: SalesDocumentStatus, userId?: string) {
    if (status !== SalesDocumentStatus.CANCELLED) throw new BadRequestException("Seule l'annulation est disponible sur une commande.");
    return this.prisma.$transaction(async (tx) => {
      const proforma = await this.findOneInTransaction(tx, tenantId, id);
      if (([SalesDocumentStatus.CANCELLED, SalesDocumentStatus.COMPLETED] as SalesDocumentStatus[]).includes(proforma.status)) {
        throw new BadRequestException("Cette commande ne peut plus être annulée.");
      }
      await restockForItems(tx, tenantId, proforma.items, proforma.id, proforma.documentNumber, userId);
      const updated = await tx.proforma.update({ where: { id }, data: { status: SalesDocumentStatus.CANCELLED, cancelledAt: new Date() }, include: documentInclude });
      return withDocumentNumber(updated);
    });
  }

  async registerPayment(tenantId: string, id: string, dto: CreateInvoicePaymentDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const proforma = await this.findOneInTransaction(tx, tenantId, id);
      if (proforma.status === SalesDocumentStatus.CANCELLED) throw new BadRequestException("Commande annulée");
      if (Number(proforma.balance) <= 0) throw new BadRequestException("Commande déjà soldée");
      if (dto.amount > Number(proforma.balance)) throw new BadRequestException("Paiement supérieur à la balance");

      // Decrement atomique gardee par balance >= montant : Postgres verrouille la ligne le temps de
      // la transaction, donc deux paiements concurrents (ex. double-clic sur le dernier versement)
      // se serialisent - le second relit le solde deja mis a jour par le premier et echoue proprement
      // au lieu de completer la commande deux fois et generer deux factures.
      const updateResult = await tx.proforma.updateMany({
        where: { id, tenantId, balance: { gte: dto.amount } },
        data: { paidAmount: { increment: dto.amount }, balance: { decrement: dto.amount } }
      });
      if (updateResult.count === 0) throw new BadRequestException("Paiement supérieur à la balance");
      await tx.payment.create({ data: { proformaId: id, method: dto.method, amount: dto.amount, reference: dto.reference, notes: dto.notes, createdById: userId } });
      const refreshedProforma = await tx.proforma.findUniqueOrThrow({ where: { id } });
      const isComplete = Number(refreshedProforma.balance) <= 0;
      const paymentStatus = isComplete ? SalesDocumentPaymentStatus.PAID : SalesDocumentPaymentStatus.PARTIALLY_PAID;
      await tx.proforma.update({
        where: { id },
        data: { paymentStatus, ...(isComplete ? { status: SalesDocumentStatus.COMPLETED, completedAt: new Date() } : {}) }
      });
      if (isComplete) await this.generateInvoice(tx, tenantId, id, userId);
      const refreshed = await tx.proforma.findUniqueOrThrow({ where: { id }, include: documentInclude });
      return withDocumentNumber(refreshed);
    });
  }

  async summary(tenantId: string) {
    const [inProgress, completed, deposits, balances] = await this.prisma.$transaction([
      this.prisma.proforma.count({ where: { tenantId, status: SalesDocumentStatus.CONFIRMED } }),
      this.prisma.proforma.count({ where: { tenantId, status: SalesDocumentStatus.COMPLETED } }),
      this.prisma.payment.aggregate({ where: { proforma: { tenantId } }, _sum: { amount: true } }),
      this.prisma.proforma.aggregate({ where: { tenantId, status: SalesDocumentStatus.CONFIRMED, balance: { gt: 0 } }, _sum: { balance: true } })
    ]);
    return {
      ordersInProgress: inProgress,
      depositsReceived: Number(deposits._sum.amount ?? 0),
      balancesToCollect: Number(balances._sum.balance ?? 0),
      completedOrders: completed
    };
  }

  private async generateInvoice(tx: Prisma.TransactionClient, tenantId: string, proformaId: string, createdById?: string) {
    const existing = await tx.invoice.findFirst({ where: { proformaId } });
    if (existing) return existing;
    const proforma = await tx.proforma.findUniqueOrThrow({ where: { id: proformaId }, include: { items: true } });
    const lines = proforma.items as SalesDocumentLine[];
    return tx.invoice.create({
      data: {
        tenantId,
        customerId: proforma.customerId,
        proformaId: proforma.id,
        documentNumber: generateDocumentNumber("INV"),
        status: SalesDocumentStatus.PAID,
        subtotal: proforma.subtotal,
        discount: proforma.discount,
        tax: proforma.tax,
        total: proforma.total,
        paidAmount: proforma.paidAmount,
        balance: 0,
        notes: proforma.notes,
        createdById,
        issuedAt: new Date(),
        items: { create: lines.map((item) => this.copyLine(item)) }
      }
    });
  }

  private async findOneInTransaction(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    const proforma = await tx.proforma.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!proforma) throw new NotFoundException("Commande introuvable");
    return proforma;
  }

  private async resolveWarehouse(client: PrismaService | Prisma.TransactionClient, tenantId: string, warehouseId?: string) {
    if (warehouseId) {
      const warehouse = await client.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true } });
      if (!warehouse) throw new NotFoundException("Dépôt introuvable");
      return warehouse;
    }
    return client.warehouse.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: "asc" } });
  }

  private async customerSnapshot(client: PrismaService | Prisma.TransactionClient, tenantId: string, customerId: string) {
    const customer = await client.customer.findFirst({ where: { id: customerId, tenantId } });
    return customer ? { id: customer.id, name: customer.displayName, code: customer.customerCode, phone: customer.phone, email: customer.email, address: customer.address } : undefined;
  }

  private async companySnapshot(client: PrismaService | Prisma.TransactionClient, tenantId: string) {
    const tenant = await client.tenant.findUnique({ where: { id: tenantId }, include: { companyProfile: true, logo: true } });
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

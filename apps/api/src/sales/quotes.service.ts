import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalesDocumentPaymentStatus, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSalesDocumentDto, SalesDocumentQueryDto, UpdateSalesDocumentDto } from "./dto/sales-document.dto";
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

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: SalesDocumentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.QuoteWhereInput = {
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
      this.prisma.quote.findMany({ where, include: { customer: true, items: { include: { product: true } } }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.quote.count({ where })
    ]);
    return { items: withDocumentNumbers(items), meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async findOne(tenantId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, tenantId }, include: { customer: true, items: { include: { product: true } }, proformas: true } });
    if (!quote) throw new NotFoundException("Devis introuvable");
    return withDocumentNumber({ ...quote, customerHistoryPrepared: true, printFormats: ["A4_LETTER"] });
  }

  async create(tenantId: string, dto: CreateSalesDocumentDto, createdById?: string) {
    await ensureCustomer(this.prisma, tenantId, dto.customerId);
    await ensureProducts(this.prisma, tenantId, dto.items.map((item) => item.productId).filter((id): id is string => Boolean(id)));
    const totals = calculateDocumentTotals(dto.items, dto.discount ?? 0);
    const quote = await this.prisma.quote.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        documentNumber: generateDocumentNumber("DEV"),
        status: SalesDocumentStatus.DRAFT,
        notes: dto.notes,
        terms: dto.terms,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : this.defaultExpirationDate(),
        customerSnapshot: dto.customerId ? await this.customerSnapshot(tenantId, dto.customerId) : undefined,
        companySnapshot: await this.companySnapshot(tenantId),
        createdById,
        ...totals,
        items: { create: mapDocumentItems(dto.items) }
      },
      include: { customer: true, items: { include: { product: true } } }
    });
    return withDocumentNumber(quote);
  }

  async update(tenantId: string, id: string, dto: UpdateSalesDocumentDto) {
    const quote = await this.findOne(tenantId, id);
    if (!([SalesDocumentStatus.DRAFT, SalesDocumentStatus.SENT] as SalesDocumentStatus[]).includes(quote.status)) {
      throw new BadRequestException("Ce devis ne peut plus être modifié");
    }
    await ensureCustomer(this.prisma, tenantId, dto.customerId);
    await ensureProducts(this.prisma, tenantId, dto.items.map((item) => item.productId).filter((productId): productId is string => Boolean(productId)));
    const totals = calculateDocumentTotals(dto.items, dto.discount ?? 0);
    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        notes: dto.notes,
        terms: dto.terms,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : quote.expiresAt,
        customerSnapshot: dto.customerId ? await this.customerSnapshot(tenantId, dto.customerId) : undefined,
        companySnapshot: await this.companySnapshot(tenantId),
        ...totals,
        items: { deleteMany: {}, create: mapDocumentItems(dto.items) }
      },
      include: { customer: true, items: { include: { product: true } } }
    });
    return withDocumentNumber(updated);
  }

  async send(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return withDocumentNumber(await this.prisma.quote.update({ where: { id }, data: { status: SalesDocumentStatus.SENT, sentAt: new Date() } }));
  }

  async accept(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return withDocumentNumber(await this.prisma.quote.update({ where: { id }, data: { status: SalesDocumentStatus.ACCEPTED, acceptedAt: new Date() } }));
  }

  async reject(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return withDocumentNumber(await this.prisma.quote.update({ where: { id }, data: { status: SalesDocumentStatus.REJECTED, rejectedAt: new Date() } }));
  }

  async convertToProforma(tenantId: string, id: string, createdById?: string) {
    const quote = await this.findOne(tenantId, id);
    if (([SalesDocumentStatus.REJECTED, SalesDocumentStatus.CANCELLED, SalesDocumentStatus.CONVERTED, SalesDocumentStatus.EXPIRED] as SalesDocumentStatus[]).includes(quote.status)) {
      throw new BadRequestException("Ce devis ne peut pas être transformé");
    }
    if (quote.expiresAt && quote.expiresAt < new Date()) {
      await this.prisma.quote.update({ where: { id }, data: { status: SalesDocumentStatus.EXPIRED } });
      throw new BadRequestException("Ce devis est expiré");
    }
    const lines = quote.items as SalesDocumentLine[];
    const proforma = await this.prisma.proforma.create({
      data: {
        tenantId,
        customerId: quote.customerId,
        quoteId: quote.id,
        documentNumber: generateDocumentNumber("CMD"),
        status: SalesDocumentStatus.DRAFT,
        paymentStatus: SalesDocumentPaymentStatus.UNPAID,
        subtotal: quote.subtotal,
        discount: quote.discount,
        tax: quote.tax,
        total: quote.total,
        paidAmount: 0,
        balance: quote.total,
        notes: quote.notes,
        customerSnapshot: quote.customerSnapshot ?? undefined,
        companySnapshot: quote.companySnapshot ?? undefined,
        quoteSnapshot: this.quoteSnapshot(quote) as Prisma.InputJsonValue,
        createdById,
        items: { create: lines.map((item) => this.copyLine(item)) }
      },
      include: { customer: true, items: { include: { product: true } }, payments: true, stockReservations: true }
    });
    await this.prisma.quote.update({ where: { id }, data: { status: SalesDocumentStatus.CONVERTED, convertedAt: new Date() } });
    return withDocumentNumber(proforma);
  }

  private defaultExpirationDate() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
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

  private quoteSnapshot(quote: Awaited<ReturnType<QuotesService["findOne"]>>) {
    return {
      id: quote.id,
      number: String(quote.number ?? ""),
      total: Number(quote.total ?? 0),
      createdAt: quote.createdAt.toISOString(),
      expiresAt: quote.expiresAt ? quote.expiresAt.toISOString() : null
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

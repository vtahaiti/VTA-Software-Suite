import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CustomerStatus, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { businessDayRangeForDateKey } from "../common/business-timezone";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { CustomerStatementQueryDto } from "./dto/customer-statement-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: CustomerQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      customerType: query.customerType,
      status: query.status,
      city: query.city ? { contains: query.city, mode: "insensitive" } : undefined,
      country: query.country ? { contains: query.country, mode: "insensitive" } : undefined,
      OR: query.search ? [
        { customerCode: { contains: query.search, mode: "insensitive" } },
        { displayName: { contains: query.search, mode: "insensitive" } },
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { company: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
        { mobile: { contains: query.search, mode: "insensitive" } },
        { whatsapp: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { city: { contains: query.search, mode: "insensitive" } }
      ] : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { [sortBy]: sortOrder } as Prisma.CustomerOrderByWithRelationInput }),
      this.prisma.customer.count({ where })
    ]);

    return { items: items.map((customer) => this.withCompatibilityAliases(customer)), meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        sales: { take: 10, orderBy: { createdAt: "desc" }, include: { receipt: true, payments: true } },
        quotes: { take: 10, orderBy: { createdAt: "desc" } },
        proformas: { take: 10, orderBy: { createdAt: "desc" } },
        invoices: { take: 10, orderBy: { createdAt: "desc" } },
        salesReturns: { take: 10, orderBy: { createdAt: "desc" } }
      }
    });
    if (!customer) throw new NotFoundException("Client introuvable");
    return this.withCompatibilityAliases({
      ...customer,
      history: {
        pos: customer.sales,
        quotes: customer.quotes,
        proformas: customer.proformas,
        invoices: customer.invoices,
        returns: customer.salesReturns,
        payments: customer.sales.flatMap((sale) => sale.payments ?? [])
      },
      documents: {
        quotes: customer.quotes.length,
        proformas: customer.proformas.length,
        invoices: customer.invoices.length,
        returns: customer.salesReturns.length
      }
    });
  }

  /**
   * Releve client V1 : lecture seule, montants derives des ventes/commandes reelles
   * (pas de nouvelle table de grand livre). Volontairement simple : pas de reprise de
   * solde d'ouverture ni de rapprochement comptable avance.
   */
  async statement(tenantId: string, id: string, query: CustomerStatementQueryDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException("Client introuvable");

    const createdAt = this.dateRange(query);
    const dateFilter = createdAt ? { createdAt } : {};

    const [sales, proformas, quotes] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where: { tenantId, customerId: id, ...dateFilter },
        include: { items: true, payments: true, receipt: true },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.proforma.findMany({
        where: { tenantId, customerId: id, ...dateFilter },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.quote.findMany({
        where: { tenantId, customerId: id, ...dateFilter },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const userIds = [...new Set(sales.map((sale) => sale.createdById).filter((value): value is string => Boolean(value)))];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
    const userNames = new Map(users.map((user) => [user.id, user.name]));

    const movements = sales
      .map((sale) => {
        const paid = sale.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        return {
          type: "VENTE" as const,
          id: sale.id,
          number: sale.receipt?.number ?? sale.id.slice(-8).toUpperCase(),
          date: sale.createdAt,
          status: sale.status,
          itemsCount: sale.items.length,
          total: Number(sale.total),
          paid,
          balance: Number(sale.total) - paid,
          cashier: sale.createdById ? userNames.get(sale.createdById) ?? null : null
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const totalSales = movements.reduce((sum, movement) => sum + movement.total, 0);
    const totalPaid = movements.reduce((sum, movement) => sum + movement.paid, 0);

    return {
      customer: this.withCompatibilityAliases(customer),
      summary: {
        totalSales,
        totalPaid,
        balance: totalSales - totalPaid,
        salesCount: sales.length
      },
      movements,
      orders: proformas.map((proforma) => ({
        id: proforma.id,
        number: proforma.documentNumber,
        status: proforma.status,
        total: Number(proforma.total),
        paid: Number(proforma.paidAmount),
        balance: Number(proforma.balance),
        createdAt: proforma.createdAt
      })),
      quotes: quotes.map((quote) => ({
        id: quote.id,
        number: quote.documentNumber,
        status: quote.status,
        total: Number(quote.total),
        createdAt: quote.createdAt
      }))
    };
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    try {
      return this.withCompatibilityAliases(await this.prisma.customer.create({ data: this.buildCreateData(tenantId, dto) }));
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Code client deja existant");
      throw error;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(tenantId, id);
    return this.withCompatibilityAliases(await this.prisma.customer.update({ where: { id }, data: this.buildUpdateData(dto) }));
  }

  async delete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    try {
      return await this.prisma.customer.delete({ where: { id } });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2003") throw new ConflictException("Client lie a des documents. Utilisez l'archivage.");
      throw error;
    }
  }

  async archive(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.withCompatibilityAliases(await this.prisma.customer.update({ where: { id }, data: { status: CustomerStatus.INACTIVE, archivedAt: new Date() } }));
  }

  async block(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.withCompatibilityAliases(await this.prisma.customer.update({ where: { id }, data: { status: CustomerStatus.BLOCKED } }));
  }

  async reactivate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.withCompatibilityAliases(await this.prisma.customer.update({ where: { id }, data: { status: CustomerStatus.ACTIVE, archivedAt: null } }));
  }

  async exportCsv(tenantId: string, query: CustomerQueryDto) {
    const result = await this.findAll(tenantId, { ...query, page: 1, limit: 10000 });
    const header = ["Code", "Nom", "Entreprise", "Téléphone", "Mobile", "WhatsApp", "Email", "Ville", "Solde", "Statut"];
    const rows = result.items.map((customer) => [customer.customerCode, customer.displayName, customer.company ?? "", customer.phone ?? "", customer.mobile ?? "", customer.whatsapp ?? "", customer.email ?? "", customer.city ?? "", customer.currentBalance, customer.status]);
    return [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  async importCsv(tenantId: string, content: string) {
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException("Fichier CSV vide");
    const rows = lines.slice(1).map((line) => this.parseCsvLine(line));
    const created = [];
    for (const row of rows) {
      created.push(await this.create(tenantId, {
        customerCode: row[0] || undefined,
        displayName: row[1],
        company: row[2] || undefined,
        phone: row[3] || undefined,
        mobile: row[4] || undefined,
        whatsapp: row[5] || undefined,
        email: row[6] || undefined,
        city: row[7] || undefined,
        currentBalance: Number(row[8] || 0),
        status: (row[9] as CustomerStatus) || CustomerStatus.ACTIVE
      }));
    }
    return { imported: created.length, items: created };
  }

  private buildCreateData(tenantId: string, dto: CreateCustomerDto): Prisma.CustomerUncheckedCreateInput {
    const displayName = this.resolveDisplayName(dto);
    return { tenantId, customerCode: dto.customerCode ?? this.generateCode(), firstName: dto.firstName, lastName: dto.lastName, company: dto.company, displayName, phone: dto.phone, mobile: dto.mobile, whatsapp: dto.whatsapp, email: dto.email, website: dto.website, taxNumber: dto.taxNumber, country: dto.country, city: dto.city, address: dto.address, postalCode: dto.postalCode, creditLimit: dto.creditLimit ?? 0, currentBalance: dto.currentBalance ?? 0, customerType: dto.customerType ?? "INDIVIDUAL", status: dto.status ?? "ACTIVE", notes: dto.notes };
  }

  private buildUpdateData(dto: UpdateCustomerDto): Prisma.CustomerUncheckedUpdateInput {
    const data: Prisma.CustomerUncheckedUpdateInput = { ...dto };
    if (dto.displayName !== undefined || dto.firstName !== undefined || dto.lastName !== undefined || dto.company !== undefined) data.displayName = this.resolveDisplayName(dto);
    return data;
  }

  private resolveDisplayName(dto: Partial<CreateCustomerDto>) {
    const value = dto.displayName || [dto.firstName, dto.lastName].filter(Boolean).join(" ") || dto.company;
    if (!value || value.trim().length < 2) throw new BadRequestException("Le nom du client est obligatoire");
    return value.trim();
  }

  private parseCsvLine(line: string) {
    return line.split(",").map((value) => value.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  }

  private withCompatibilityAliases<T extends Record<string, any>>(customer: T) {
    return { ...customer, code: customer.customerCode, name: customer.displayName, type: customer.customerType, creditBalance: customer.currentBalance };
  }

  private generateCode() {
    return `CUST-${Date.now().toString(36).toUpperCase()}`;
  }

  private dateRange(query: CustomerStatementQueryDto): { gte?: Date; lt?: Date } | undefined {
    const range: { gte?: Date; lt?: Date } = {};
    if (query.dateFrom) range.gte = businessDayRangeForDateKey(query.dateFrom).start;
    if (query.dateTo) range.lt = businessDayRangeForDateKey(query.dateTo).end;
    return Object.keys(range).length ? range : undefined;
  }
}

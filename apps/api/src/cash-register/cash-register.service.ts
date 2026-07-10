import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CashMovementType, CashSessionStatus, PaymentMethod, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";
import { CloseCashSessionDto, CreateCashMovementDto, CreateCashRegisterDto, OpenCashSessionDto } from "./dto/create-cash-register.dto";

@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  registers(tenantId: string) {
    return this.prisma.cashRegister.findMany({ where: { tenantId }, include: { sessions: { orderBy: { openedAt: "desc" }, take: 1 } }, orderBy: { name: "asc" } });
  }

  async createRegister(tenantId: string, dto: CreateCashRegisterDto) {
    try {
      return await this.prisma.cashRegister.create({ data: { tenantId, name: dto.name, code: dto.code ?? this.code(dto.name), isActive: dto.isActive ?? true } });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") throw new BadRequestException("Code caisse deja existant");
      throw error;
    }
  }

  sessions(tenantId: string) {
    return this.prisma.cashSession.findMany({ where: { tenantId }, include: { cashRegister: true, sales: { include: { payments: true } }, movements: true }, orderBy: { openedAt: "desc" } });
  }

  async activeSession(tenantId: string) {
    const session = await this.prisma.cashSession.findFirst({ where: { tenantId, status: CashSessionStatus.OPEN }, include: { cashRegister: true } });
    if (!session) throw new NotFoundException("Aucune caisse ouverte");
    return session;
  }

  async open(tenantId: string, dto: OpenCashSessionDto) {
    const register = await this.prisma.cashRegister.findFirst({ where: { id: dto.cashRegisterId, tenantId, isActive: true } });
    if (!register) throw new NotFoundException("Caisse introuvable");
    const open = await this.prisma.cashSession.findFirst({ where: { tenantId, cashRegisterId: dto.cashRegisterId, status: CashSessionStatus.OPEN } });
    if (open) throw new BadRequestException("Une session est deja ouverte pour cette caisse");
    return this.prisma.cashSession.create({ data: { tenantId, cashRegisterId: dto.cashRegisterId, openingAmount: dto.openingAmount, status: CashSessionStatus.OPEN }, include: { cashRegister: true } });
  }

  async movement(tenantId: string, dto: CreateCashMovementDto) {
    const session = await this.prisma.cashSession.findFirst({ where: { id: dto.cashSessionId, tenantId, status: CashSessionStatus.OPEN } });
    if (!session) throw new NotFoundException("Session de caisse ouverte introuvable");
    return this.prisma.cashMovement.create({ data: { tenantId, cashSessionId: dto.cashSessionId, type: dto.type as CashMovementType, amount: dto.amount, reason: dto.reason, reference: dto.reference } });
  }

  async close(tenantId: string, id: string, dto: CloseCashSessionDto) {
    const session = await this.prisma.cashSession.findFirst({ where: { id, tenantId, status: CashSessionStatus.OPEN } });
    if (!session) throw new NotFoundException("Session ouverte introuvable");
    const report = await this.report(tenantId, id);
    const closingAmount = Number(dto.closingAmount);
    const variance = this.round(closingAmount - report.theoreticalAmount);
    const closed = await this.prisma.cashSession.update({ where: { id }, data: { status: CashSessionStatus.CLOSED, closingAmount, closedAt: new Date() }, include: { cashRegister: true } });
    return { ...closed, report: { ...report, closingAmount, variance } };
  }

  async report(tenantId: string, id: string) {
    const session = await this.prisma.cashSession.findFirst({ where: { id, tenantId }, include: { cashRegister: true, sales: { include: { payments: true } }, movements: true } });
    if (!session) throw new NotFoundException("Session de caisse introuvable");
    const openingAmount = Number(session.openingAmount);
    const cashSales = session.sales.reduce((sum, sale) => sum + sale.payments.filter((payment) => payment.method === PaymentMethod.CASH).reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0), 0);
    const cardSales = session.sales.reduce((sum, sale) => sum + sale.payments.filter((payment) => payment.method !== PaymentMethod.CASH).reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0), 0);
    const cashIn = session.movements.filter((movement) => movement.type === CashMovementType.IN).reduce((sum, movement) => sum + Number(movement.amount), 0);
    const cashOut = session.movements.filter((movement) => movement.type === CashMovementType.OUT).reduce((sum, movement) => sum + Number(movement.amount), 0);
    const theoreticalAmount = this.round(openingAmount + cashSales + cashIn - cashOut);
    const closingAmount = session.closingAmount === null ? null : Number(session.closingAmount);
    return {
      id: session.id,
      cashRegister: session.cashRegister,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingAmount,
      cashSales: this.round(cashSales),
      nonCashSales: this.round(cardSales),
      cashIn: this.round(cashIn),
      cashOut: this.round(cashOut),
      salesCount: session.sales.length,
      movementsCount: session.movements.length,
      theoreticalAmount,
      closingAmount,
      variance: closingAmount === null ? null : this.round(closingAmount - theoreticalAmount),
      movements: session.movements,
      sales: session.sales
    };
  }

  private code(value: string) { return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 24); }
  private round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SalesPaymentsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(tenantId: string) {
    const payments = await this.prisma.payment.findMany({ where: { OR: [{ sale: { tenantId } }, { invoice: { tenantId } }] }, include: { invoice: { include: { customer: true } }, sale: true }, orderBy: { createdAt: "desc" } });
    return payments.map((payment) => ({ ...payment, documentNumber: payment.invoice?.documentNumber, number: payment.invoice?.documentNumber }));
  }
  async findOne(tenantId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, OR: [{ sale: { tenantId } }, { invoice: { tenantId } }] }, include: { invoice: { include: { customer: true } }, sale: true } });
    if (!payment) throw new NotFoundException("Paiement introuvable");
    return payment;
  }
}
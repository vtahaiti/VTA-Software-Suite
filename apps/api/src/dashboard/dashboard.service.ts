import { Injectable } from "@nestjs/common";
import { SaleStatus, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const start30Days = new Date(startOfDay);
      start30Days.setDate(start30Days.getDate() - 29);

      const [salesToday, products, lowStockItems, invoices, salesLast30Days] = await this.prisma.$transaction([
        this.prisma.sale.count({
          where: {
            tenantId,
            status: SaleStatus.COMPLETED,
            createdAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        this.prisma.product.count({ where: { tenantId, isActive: true } }),
        this.prisma.stock.findMany({
          where: { tenantId },
          select: { quantity: true, minimumStock: true }
        }),
        this.prisma.invoice.count({
          where: { tenantId, status: { not: SalesDocumentStatus.CANCELLED } }
        }),
        this.prisma.sale.findMany({
          where: {
            tenantId,
            status: SaleStatus.COMPLETED,
            createdAt: { gte: start30Days, lt: endOfDay }
          },
          select: { total: true, createdAt: true },
          orderBy: { createdAt: "asc" }
        })
      ]);

      return {
        databaseAvailable: true,
        salesToday,
        products,
        invoices,
        lowStock: lowStockItems.filter((item) => item.quantity <= item.minimumStock).length,
        salesLast30Days: this.buildSalesTrend(start30Days, salesLast30Days)
      };
    } catch {
      return this.emptySummary(false);
    }
  }

  private buildSalesTrend(startDate: Date, sales: Array<{ total: unknown; createdAt: Date }>) {
    const days = new Map<string, { date: string; total: number; count: number }>();
    for (let index = 0; index < 30; index += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const key = this.dateKey(date);
      days.set(key, { date: key, total: 0, count: 0 });
    }

    for (const sale of sales) {
      const key = this.dateKey(sale.createdAt);
      const current = days.get(key);
      if (!current) continue;
      current.total += Number(sale.total ?? 0);
      current.count += 1;
    }

    return Array.from(days.values());
  }

  private dateKey(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private emptySummary(databaseAvailable: boolean) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
    return {
      databaseAvailable,
      salesToday: 0,
      products: 0,
      invoices: 0,
      lowStock: 0,
      salesLast30Days: this.buildSalesTrend(start, [])
    };
  }
}

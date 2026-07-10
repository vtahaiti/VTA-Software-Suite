import { Injectable } from "@nestjs/common";
import { PaymentMethod, Prisma, PurchaseOrderStatus, SaleStatus, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type CacheEntry = { expiresAt: number; data: unknown };
type TrendPoint = { date: string; sales: number; revenue: number; profit: number; customers: number };

@Injectable()
export class DashboardService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const cacheKey = `dashboard:${tenantId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
      const now = new Date();
      const startOfDay = this.startOfDay(now);
      const endOfDay = this.addDays(startOfDay, 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = startOfMonth;
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = startOfYear;
      const start30Days = this.addDays(startOfDay, -29);
      const completedSaleWhere: Prisma.SaleWhereInput = { tenantId, status: SaleStatus.COMPLETED };

      const [
        sales,
        saleItems,
        payments,
        customers,
        products,
        stocks,
        invoices,
        pendingOrders,
        recentSales,
        recentCustomer,
        recentProduct,
        recentInvoice,
        recentPayment
      ] = await this.prisma.$transaction([
        this.prisma.sale.findMany({
          where: { ...completedSaleWhere, createdAt: { gte: start30Days, lt: endOfDay } },
          select: { id: true, total: true, subtotal: true, discount: true, tax: true, createdAt: true, status: true },
          orderBy: { createdAt: "asc" }
        }),
        this.prisma.saleItem.findMany({
          where: { sale: { ...completedSaleWhere, createdAt: { gte: start30Days, lt: endOfDay } } },
          include: { product: { include: { category: true } }, sale: { select: { createdAt: true } } }
        }),
        this.prisma.payment.findMany({
          where: { sale: { tenantId, createdAt: { gte: start30Days, lt: endOfDay } } },
          select: { method: true, amount: true, createdAt: true }
        }),
        this.prisma.customer.findMany({
          where: { tenantId },
          select: { id: true, displayName: true, createdAt: true },
          orderBy: { createdAt: "desc" }
        }),
        this.prisma.product.findMany({
          where: { tenantId, isActive: true },
          include: { category: true, stocks: true }
        }),
        this.prisma.stock.findMany({
          where: { tenantId },
          include: { product: true, warehouse: true },
          orderBy: { updatedAt: "desc" }
        }),
        this.prisma.invoice.findMany({
          where: { tenantId },
          select: { id: true, documentNumber: true, status: true, total: true, paidAmount: true, balance: true, createdAt: true, updatedAt: true },
          orderBy: { createdAt: "desc" }
        }),
        this.prisma.purchaseOrder.count({ where: { tenantId, status: { in: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT, PurchaseOrderStatus.APPROVED] } } }),
        this.prisma.sale.findMany({
          where: completedSaleWhere,
          include: { customer: true, receipt: true },
          orderBy: { createdAt: "desc" },
          take: 1
        }),
        this.prisma.customer.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
        this.prisma.product.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
        this.prisma.invoice.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
        this.prisma.payment.findFirst({ where: { sale: { tenantId } }, orderBy: { createdAt: "desc" }, include: { sale: true } })
      ]);

      const allTimeSalesCount = await this.prisma.sale.count({ where: completedSaleWhere });
      const allTimeRevenue = await this.prisma.sale.aggregate({ where: completedSaleWhere, _sum: { total: true } });
      const salesToday = sales.filter((sale) => sale.createdAt >= startOfDay && sale.createdAt < endOfDay);
      const salesThisMonth = sales.filter((sale) => sale.createdAt >= startOfMonth && sale.createdAt < endOfDay);
      const salesLastMonth = await this.prisma.sale.findMany({
        where: { ...completedSaleWhere, createdAt: { gte: startOfLastMonth, lt: endOfLastMonth } },
        select: { total: true }
      });
      const salesThisYearAggregate = await this.prisma.sale.aggregate({ where: { ...completedSaleWhere, createdAt: { gte: startOfYear, lt: endOfDay } }, _sum: { total: true } });
      const salesLastYearAggregate = await this.prisma.sale.aggregate({ where: { ...completedSaleWhere, createdAt: { gte: startOfLastYear, lt: endOfLastYear } }, _sum: { total: true } });

      const productCost = new Map(products.map((product) => [product.id, this.money(product.averageCost) || this.money(product.purchasePrice)]));
      const revenueToday = this.sum(salesToday.map((sale) => this.money(sale.total)));
      const revenueMonth = this.sum(salesThisMonth.map((sale) => this.money(sale.total)));
      const revenueLastMonth = this.sum(salesLastMonth.map((sale) => this.money(sale.total)));
      const costMonth = this.sum(saleItems.filter((item) => item.sale.createdAt >= startOfMonth && item.productId).map((item) => (productCost.get(item.productId ?? "") ?? 0) * item.quantity));
      const profitMonth = revenueMonth - costMonth;
      const stockValue = this.sum(stocks.map((stock) => stock.quantity * (productCost.get(stock.productId) ?? this.money(stock.product.purchasePrice))));
      const lowStockProducts = stocks.filter((stock) => stock.quantity > 0 && stock.quantity <= stock.minimumStock);
      const outOfStockProducts = stocks.filter((stock) => stock.quantity <= 0);
      const paidInvoices = invoices.filter((invoice) => invoice.status === SalesDocumentStatus.PAID || this.money(invoice.balance) <= 0);
      const unpaidInvoices = invoices.filter((invoice) => invoice.status !== SalesDocumentStatus.CANCELLED && this.money(invoice.balance) > 0);
      const overdueInvoices = unpaidInvoices.filter((invoice) => invoice.createdAt < this.addDays(startOfDay, -30));
      const averageOrderValue = allTimeSalesCount > 0 ? this.money(allTimeRevenue._sum.total) / allTimeSalesCount : 0;
      const averageDailySales = sales.length / 30;

      const trend30Days = this.buildTrend(start30Days, sales, saleItems, customers);
      const weeklySales = this.buildWeeklyTrend(trend30Days);
      const topProducts = this.topProducts(saleItems);
      const salesByCategory = this.salesByCategory(saleItems);
      const paymentMethods = this.paymentMethods(payments);
      const stockValueByCategory = this.stockValueByCategory(products);
      const monthlyGrowth = revenueLastMonth > 0 ? ((revenueMonth - revenueLastMonth) / revenueLastMonth) * 100 : revenueMonth > 0 ? 100 : 0;
      const revenueThisYear = this.money(salesThisYearAggregate._sum.total);
      const revenueLastYear = this.money(salesLastYearAggregate._sum.total);
      const annualGrowth = revenueLastYear > 0 ? ((revenueThisYear - revenueLastYear) / revenueLastYear) * 100 : revenueThisYear > 0 ? 100 : 0;
      const marginAverage = revenueMonth > 0 ? (profitMonth / revenueMonth) * 100 : 0;

      const result = {
        databaseAvailable: true,
        generatedAt: now.toISOString(),
        kpis: {
          revenueToday,
          revenueMonth,
          profitMonth,
          salesToday: salesToday.length,
          salesTotal: allTimeSalesCount,
          customersTotal: customers.length,
          productsTotal: products.length,
          outOfStock: outOfStockProducts.length,
          lowStock: lowStockProducts.length,
          invoicesPaid: paidInvoices.length,
          invoicesUnpaid: unpaidInvoices.length,
          pendingOrders
        },
        performance: {
          stockValue,
          businessValue: stockValue + this.money(allTimeRevenue._sum.total),
          estimatedProfit: profitMonth,
          averageMargin: this.round(marginAverage),
          averageOrderValue,
          averageDailySales: this.round(averageDailySales),
          monthlyGrowth: this.round(monthlyGrowth),
          annualGrowth: this.round(annualGrowth)
        },
        charts: {
          trend30Days,
          profitEvolution: trend30Days.map((point) => ({ date: point.date, value: point.profit })),
          revenueEvolution: trend30Days.map((point) => ({ date: point.date, value: point.revenue })),
          weeklySales,
          topProducts,
          salesByCategory,
          paymentMethods,
          customerEvolution: trend30Days.map((point) => ({ date: point.date, value: point.customers })),
          stockValueByCategory
        },
        recentActivity: [
          recentSales[0] ? { type: "Derniere vente", label: recentSales[0].receipt?.number ?? recentSales[0].id, amount: this.money(recentSales[0].total), createdAt: recentSales[0].createdAt } : null,
          recentCustomer ? { type: "Dernier client", label: recentCustomer.displayName, amount: 0, createdAt: recentCustomer.createdAt } : null,
          recentProduct ? { type: "Dernier produit", label: recentProduct.name, amount: this.money(recentProduct.salePrice), createdAt: recentProduct.createdAt } : null,
          recentInvoice ? { type: "Derniere facture", label: recentInvoice.documentNumber, amount: this.money(recentInvoice.total), createdAt: recentInvoice.createdAt } : null,
          recentPayment ? { type: "Dernier paiement", label: recentPayment.method, amount: this.money(recentPayment.amount), createdAt: recentPayment.createdAt } : null
        ].filter(Boolean),
        alerts: [
          ...outOfStockProducts.slice(0, 4).map((stock) => ({ type: "Rupture", message: `${stock.product.name} est en rupture`, severity: "critical" })),
          ...lowStockProducts.slice(0, 4).map((stock) => ({ type: "Stock faible", message: `${stock.product.name} arrive au seuil minimum`, severity: "warning" })),
          ...overdueInvoices.slice(0, 3).map((invoice) => ({ type: "Facture en retard", message: `${invoice.documentNumber} reste impayee`, severity: "warning" })),
          ...(pendingOrders > 0 ? [{ type: "Commandes", message: `${pendingOrders} commande(s) en attente`, severity: "info" }] : [])
        ],
        topSalesTable: topProducts
      };

      this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 30_000 });
      return result;
    } catch {
      return this.emptySummary();
    }
  }

  private buildTrend(startDate: Date, sales: Array<{ id: string; total: Prisma.Decimal; createdAt: Date }>, saleItems: Array<{ productId: string | null; quantity: number; total: Prisma.Decimal; sale: { createdAt: Date }; product: { averageCost: Prisma.Decimal; purchasePrice: Prisma.Decimal } | null }>, customers: Array<{ createdAt: Date }>): TrendPoint[] {
    const days = new Map<string, TrendPoint>();
    for (let index = 0; index < 30; index += 1) {
      const date = this.addDays(startDate, index);
      const key = this.dateKey(date);
      days.set(key, { date: key, sales: 0, revenue: 0, profit: 0, customers: 0 });
    }
    for (const sale of sales) {
      const point = days.get(this.dateKey(sale.createdAt));
      if (!point) continue;
      point.sales += 1;
      point.revenue += this.money(sale.total);
    }
    for (const item of saleItems) {
      const point = days.get(this.dateKey(item.sale.createdAt));
      if (!point || !item.product) continue;
      const cost = this.money(item.product.averageCost) || this.money(item.product.purchasePrice);
      point.profit += this.money(item.total) - cost * item.quantity;
    }
    for (const customer of customers) {
      const point = days.get(this.dateKey(customer.createdAt));
      if (point) point.customers += 1;
    }
    return Array.from(days.values()).map((point) => ({ ...point, revenue: this.round(point.revenue), profit: this.round(point.profit) }));
  }

  private buildWeeklyTrend(points: TrendPoint[]) {
    const weeks = new Map<string, { label: string; sales: number; revenue: number }>();
    points.forEach((point, index) => {
      const label = `Semaine ${Math.floor(index / 7) + 1}`;
      const current = weeks.get(label) ?? { label, sales: 0, revenue: 0 };
      current.sales += point.sales;
      current.revenue += point.revenue;
      weeks.set(label, current);
    });
    return Array.from(weeks.values()).map((week) => ({ ...week, revenue: this.round(week.revenue) }));
  }

  private topProducts(items: Array<{ productId: string | null; quantity: number; total: Prisma.Decimal; customName?: string | null; product: { name: string; sku: string; averageCost: Prisma.Decimal; purchasePrice: Prisma.Decimal } | null }>) {
    const rows = new Map<string, { product: string; sku: string; quantity: number; revenue: number; profit: number }>();
    for (const item of items) {
      if (!item.productId || !item.product) continue;
      const cost = this.money(item.product.averageCost) || this.money(item.product.purchasePrice);
      const current = rows.get(item.productId) ?? { product: item.product.name, sku: item.product.sku, quantity: 0, revenue: 0, profit: 0 };
      current.quantity += item.quantity;
      current.revenue += this.money(item.total);
      current.profit += this.money(item.total) - cost * item.quantity;
      rows.set(item.productId, current);
    }
    return Array.from(rows.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((row) => ({ ...row, revenue: this.round(row.revenue), profit: this.round(row.profit) }));
  }

  private salesByCategory(items: Array<{ total: Prisma.Decimal; product: { category?: { name: string } | null } | null }>) {
    const rows = new Map<string, number>();
    for (const item of items) {
      const category = item.product?.category?.name ?? "Articles personnalisés";
      rows.set(category, (rows.get(category) ?? 0) + this.money(item.total));
    }
    return Array.from(rows.entries()).map(([label, value]) => ({ label, value: this.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }

  private paymentMethods(payments: Array<{ method: PaymentMethod; amount: Prisma.Decimal }>) {
    const rows = new Map<string, number>();
    for (const payment of payments) rows.set(payment.method, (rows.get(payment.method) ?? 0) + this.money(payment.amount));
    return Array.from(rows.entries()).map(([label, value]) => ({ label, value: this.round(value) })).sort((a, b) => b.value - a.value);
  }

  private stockValueByCategory(products: Array<{ category?: { name: string } | null; purchasePrice: Prisma.Decimal; averageCost: Prisma.Decimal; stocks: Array<{ quantity: number }> }>) {
    const rows = new Map<string, number>();
    for (const product of products) {
      const category = product.category?.name ?? "Sans categorie";
      const quantity = product.stocks.reduce((sum, stock) => sum + stock.quantity, 0);
      const cost = this.money(product.averageCost) || this.money(product.purchasePrice);
      rows.set(category, (rows.get(category) ?? 0) + quantity * cost);
    }
    return Array.from(rows.entries()).map(([label, value]) => ({ label, value: this.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }

  private emptySummary() {
    return {
      databaseAvailable: false,
      generatedAt: new Date().toISOString(),
      kpis: {
        revenueToday: 0, revenueMonth: 0, profitMonth: 0, salesToday: 0, salesTotal: 0, customersTotal: 0, productsTotal: 0,
        outOfStock: 0, lowStock: 0, invoicesPaid: 0, invoicesUnpaid: 0, pendingOrders: 0
      },
      performance: { stockValue: 0, businessValue: 0, estimatedProfit: 0, averageMargin: 0, averageOrderValue: 0, averageDailySales: 0, monthlyGrowth: 0, annualGrowth: 0 },
      charts: { trend30Days: [], profitEvolution: [], revenueEvolution: [], weeklySales: [], topProducts: [], salesByCategory: [], paymentMethods: [], customerEvolution: [], stockValueByCategory: [] },
      recentActivity: [],
      alerts: [{ type: "Base de donnees", message: "Impossible de charger les donnees du tableau de bord.", severity: "critical" }],
      topSalesTable: []
    };
  }

  private startOfDay(date: Date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private addDays(date: Date, days: number) {
    const value = new Date(date);
    value.setDate(value.getDate() + days);
    return value;
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private money(value: Prisma.Decimal | number | string | null | undefined) {
    return Number(value ?? 0);
  }

  private sum(values: number[]) {
    return values.reduce((total, value) => total + value, 0);
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

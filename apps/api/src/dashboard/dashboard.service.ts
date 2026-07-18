import { Injectable } from "@nestjs/common";
import { PaymentMethod, Prisma, PurchaseOrderStatus, SaleStatus, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { addBusinessDays, businessDateKey, businessDayRange, businessMonthRange, businessYearRange, normalizeBusinessTimeZone } from "../common/business-timezone";
import { availableStock, countLowStockProducts, countOutOfStockProducts, isLowStock, isOutOfStock, knownUnitCost } from "../common/stock-business-rules";

type CacheEntry = { expiresAt: number; data: unknown };
type TrendPoint = { date: string; sales: number; revenue: number; profit: number | null; customers: number; revenueWithoutCost: number; missingCostLines: number };
type ProductCostProduct = { averageCost: Prisma.Decimal | number | string | null; purchasePrice: Prisma.Decimal | number | string | null };
type SaleItemForProfit = { productId: string | null; quantity: number; total: Prisma.Decimal; sale: { createdAt: Date }; product: (ProductCostProduct & { name?: string; sku?: string; category?: { name: string } | null }) | null };
type DashboardUser = { role?: string | null; roles?: string[] | null; permissions?: string[] | null };
type DashboardAccess = "FULL" | "MANAGER" | "CASHIER" | "STOCK" | "OBSERVER" | "BASIC";
type StockForValuation = {
  productId?: string | null;
  quantity: number;
  reserved?: number | null;
  minimumStock?: number | null;
  product: ProductCostProduct & {
    id?: string;
    isActive?: boolean | null;
    salePrice?: Prisma.Decimal | number | string | null;
    minimumStock?: Prisma.Decimal | number | string | null;
  };
};

@Injectable()
export class DashboardService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string, user?: DashboardUser) {
    const access = this.dashboardAccess(user);
    const cacheKey = `dashboard:${tenantId}:${access}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
      const now = new Date();
      const timeZone = await this.tenantTimeZone(tenantId);
      const { start: startOfDay, end: endOfDay } = businessDayRange(now, timeZone);
      const { start: startOfMonth } = businessMonthRange(now, timeZone);
      const startOfLastMonth = businessMonthRange(new Date(startOfMonth.getTime() - 12 * 60 * 60 * 1000), timeZone).start;
      const endOfLastMonth = startOfMonth;
      const { start: startOfYear } = businessYearRange(now, timeZone);
      const startOfLastYear = businessYearRange(new Date(startOfYear.getTime() - 12 * 60 * 60 * 1000), timeZone).start;
      const endOfLastYear = startOfYear;
      const start30Days = addBusinessDays(startOfDay, -29, timeZone);
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
        this.prisma.customer.findMany({ where: { tenantId }, select: { id: true, displayName: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
        this.prisma.product.findMany({ where: { tenantId, isActive: true }, include: { category: true, stocks: true } }),
        this.prisma.stock.findMany({ where: { tenantId }, include: { product: true, warehouse: true }, orderBy: { updatedAt: "desc" } }),
        this.prisma.invoice.findMany({ where: { tenantId }, select: { id: true, documentNumber: true, status: true, total: true, paidAmount: true, balance: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" } }),
        this.prisma.purchaseOrder.count({ where: { tenantId, status: { in: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT, PurchaseOrderStatus.APPROVED] } } }),
        this.prisma.sale.findMany({ where: completedSaleWhere, include: { customer: true, receipt: true }, orderBy: { createdAt: "desc" }, take: 1 }),
        this.prisma.customer.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
        this.prisma.product.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
        this.prisma.invoice.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
        this.prisma.payment.findFirst({ where: { sale: { tenantId } }, orderBy: { createdAt: "desc" }, include: { sale: true } })
      ]);

      const allTimeSalesCount = await this.prisma.sale.count({ where: completedSaleWhere });
      const allTimeRevenue = await this.prisma.sale.aggregate({ where: completedSaleWhere, _sum: { total: true } });
      const salesToday = sales.filter((sale) => sale.createdAt >= startOfDay && sale.createdAt < endOfDay);
      const salesThisMonth = sales.filter((sale) => sale.createdAt >= startOfMonth && sale.createdAt < endOfDay);
      const salesLastMonth = await this.prisma.sale.findMany({ where: { ...completedSaleWhere, createdAt: { gte: startOfLastMonth, lt: endOfLastMonth } }, select: { total: true } });
      const salesThisYearAggregate = await this.prisma.sale.aggregate({ where: { ...completedSaleWhere, createdAt: { gte: startOfYear, lt: endOfDay } }, _sum: { total: true } });
      const salesLastYearAggregate = await this.prisma.sale.aggregate({ where: { ...completedSaleWhere, createdAt: { gte: startOfLastYear, lt: endOfLastYear } }, _sum: { total: true } });

      const revenueToday = this.sum(salesToday.map((sale) => this.money(sale.total)));
      const revenueMonth = this.sum(salesThisMonth.map((sale) => this.money(sale.total)));
      const revenueLastMonth = this.sum(salesLastMonth.map((sale) => this.money(sale.total)));
      const monthProfit = this.profitSummary(saleItems.filter((item) => item.sale.createdAt >= startOfMonth));
      const profitMonth = monthProfit.reliable ? this.round(revenueMonth - monthProfit.knownCost) : null;
      const activeStocks = stocks.filter((stock) => stock.product?.isActive !== false);
      const stockValuation = this.stockValuation(activeStocks);
      const stockValue = stockValuation.knownStockValue;
      const lowStockProducts = activeStocks.filter(isLowStock);
      const outOfStockProducts = activeStocks.filter(isOutOfStock);
      const lowStockProductCount = countLowStockProducts(activeStocks);
      const outOfStockProductCount = countOutOfStockProducts(activeStocks);
      const missingCostProductCount = stockValuation.productsWithoutCost;
      const paidInvoices = invoices.filter((invoice) => invoice.status === SalesDocumentStatus.PAID || this.money(invoice.balance) <= 0);
      const unpaidInvoices = invoices.filter((invoice) => invoice.status !== SalesDocumentStatus.CANCELLED && this.money(invoice.balance) > 0);
      const overdueInvoices = unpaidInvoices.filter((invoice) => invoice.createdAt < addBusinessDays(startOfDay, -30, timeZone));
      const averageOrderValue = allTimeSalesCount > 0 ? this.money(allTimeRevenue._sum.total) / allTimeSalesCount : 0;
      const averageDailySales = sales.length / 30;

      const trend30Days = this.buildTrend(start30Days, sales, saleItems, customers, timeZone);
      const weeklySales = this.buildWeeklyTrend(trend30Days);
      const topProducts = this.topProducts(saleItems);
      const salesByCategory = this.salesByCategory(saleItems);
      const paymentMethods = this.paymentMethods(payments);
      const stockValueByCategory = this.stockValueByCategory(products);
      const monthlyGrowth = this.growthValue(revenueMonth, revenueLastMonth);
      const revenueThisYear = this.money(salesThisYearAggregate._sum.total);
      const revenueLastYear = this.money(salesLastYearAggregate._sum.total);
      const annualGrowth = this.growthValue(revenueThisYear, revenueLastYear);
      const marginAverage = profitMonth !== null && revenueMonth > 0 ? (profitMonth / revenueMonth) * 100 : null;

      const result = {
        databaseAvailable: true,
        dashboardScope: access,
        generatedAt: now.toISOString(),
        kpis: {
          revenueToday,
          revenueMonth,
          profitMonth,
          profitReliable: monthProfit.reliable,
          costIncompleteMessage: monthProfit.reliable ? null : "Données de coût incomplètes",
          salesToday: salesToday.length,
          salesTotal: allTimeSalesCount,
          customersTotal: customers.length,
          productsTotal: products.length,
          outOfStock: outOfStockProductCount,
          lowStock: lowStockProductCount,
          invoicesPaid: paidInvoices.length,
          invoicesUnpaid: unpaidInvoices.length,
          pendingOrders
        },
        performance: {
          stockValue,
          knownStockValue: stockValuation.knownStockValue,
          salePotentialValue: stockValuation.salePotentialValue,
          potentialKnownMargin: stockValuation.potentialKnownMargin,
          stockValuePartial: missingCostProductCount > 0,
          missingCostProducts: missingCostProductCount,
          businessValue: stockValuation.salePotentialValue,
          estimatedProfit: profitMonth,
          profitReliable: monthProfit.reliable,
          missingCostSaleLines: monthProfit.missingCostLines,
          revenueWithoutCost: monthProfit.revenueWithoutCost,
          costCoverageRate: revenueMonth > 0 ? this.round(((revenueMonth - monthProfit.revenueWithoutCost) / revenueMonth) * 100) : 100,
          averageMargin: marginAverage === null ? null : this.round(marginAverage),
          averageOrderValue,
          averageDailySales: this.round(averageDailySales),
          monthlyGrowth: monthlyGrowth.value,
          monthlyGrowthLabel: monthlyGrowth.label,
          annualGrowth: annualGrowth.value,
          annualGrowthLabel: annualGrowth.label
        },
        charts: {
          trend30Days,
          profitEvolution: trend30Days.map((point) => ({ date: point.date, value: point.profit, reliable: point.profit !== null, revenueWithoutCost: point.revenueWithoutCost })),
          revenueEvolution: trend30Days.map((point) => ({ date: point.date, value: point.revenue })),
          weeklySales,
          topProducts,
          salesByCategory,
          paymentMethods,
          customerEvolution: trend30Days.map((point) => ({ date: point.date, value: point.customers })),
          stockValueByCategory
        },
        recentActivity: [
          recentSales[0] ? { type: "Dernière vente", label: recentSales[0].receipt?.number ?? recentSales[0].id, amount: this.money(recentSales[0].total), createdAt: recentSales[0].createdAt } : null,
          recentCustomer ? { type: "Dernier client", label: recentCustomer.displayName, amount: 0, createdAt: recentCustomer.createdAt } : null,
          recentProduct ? { type: "Dernier produit", label: recentProduct.name, amount: this.money(recentProduct.salePrice), createdAt: recentProduct.createdAt } : null,
          recentInvoice ? { type: "Dernière facture", label: recentInvoice.documentNumber, amount: this.money(recentInvoice.total), createdAt: recentInvoice.createdAt } : null,
          recentPayment ? { type: "Dernier paiement", label: recentPayment.method, amount: this.money(recentPayment.amount), createdAt: recentPayment.createdAt } : null
        ].filter(Boolean),
        alerts: [
          ...outOfStockProducts.slice(0, 4).map((stock) => ({ type: "Rupture", message: `${stock.product.name} est en rupture`, severity: "critical" })),
          ...lowStockProducts.slice(0, 4).map((stock) => ({ type: "Stock faible", message: `${stock.product.name} arrive au seuil minimum`, severity: "warning" })),
          ...(missingCostProductCount > 0 ? [{ type: "Coûts manquants", message: `${missingCostProductCount} produit(s) ont un coût non renseigné`, severity: "warning" }] : []),
          ...overdueInvoices.slice(0, 3).map((invoice) => ({ type: "Facture en retard", message: `${invoice.documentNumber} reste impayée`, severity: "warning" })),
          ...(pendingOrders > 0 ? [{ type: "Commandes", message: `${pendingOrders} commande(s) en attente`, severity: "info" }] : [])
        ],
        topSalesTable: topProducts
      };

      const scopedResult = this.restrictSummaryForAccess(result, access);
      this.cache.set(cacheKey, { data: scopedResult, expiresAt: Date.now() + 30_000 });
      return scopedResult;
    } catch {
      return this.emptySummary();
    }
  }

  private profitSummary(items: SaleItemForProfit[]) {
    let knownCost = 0;
    let revenueWithoutCost = 0;
    let missingCostLines = 0;
    for (const item of items) {
      const revenue = this.money(item.total);
      if (!item.product) {
        revenueWithoutCost += revenue;
        missingCostLines += 1;
        continue;
      }
      const cost = knownUnitCost(item.product);
      if (!cost.known || cost.amount === null) {
        revenueWithoutCost += revenue;
        missingCostLines += 1;
        continue;
      }
      knownCost += cost.amount * item.quantity;
    }
    return { knownCost: this.round(knownCost), revenueWithoutCost: this.round(revenueWithoutCost), missingCostLines, reliable: missingCostLines === 0 };
  }

  private stockValuation(stocks: StockForValuation[]) {
    const productsWithoutCost = new Set<string>();
    let knownStockValue = 0;
    let salePotentialValue = 0;
    let potentialKnownMargin = 0;

    for (const stock of stocks) {
      if (stock.product?.isActive === false) continue;
      const quantity = availableStock(stock);
      if (quantity <= 0) continue;

      const productKey = stock.productId ?? stock.product?.id ?? "unknown";
      const cost = knownUnitCost(stock.product);
      const salePrice = this.money(stock.product.salePrice);

      if (cost.known && cost.amount !== null) knownStockValue += quantity * cost.amount;
      else productsWithoutCost.add(productKey);

      if (salePrice > 0) {
        salePotentialValue += quantity * salePrice;
        if (cost.known && cost.amount !== null) potentialKnownMargin += quantity * (salePrice - cost.amount);
      }
    }

    return {
      knownStockValue: this.round(knownStockValue),
      salePotentialValue: this.round(salePotentialValue),
      potentialKnownMargin: this.round(potentialKnownMargin),
      productsWithoutCost: productsWithoutCost.size
    };
  }

  private dashboardAccess(user?: DashboardUser): DashboardAccess {
    const roles = [user?.role, ...(user?.roles ?? [])].filter(Boolean).map((role) => String(role).toUpperCase());
    const roleText = roles.join(" ");
    if (roleText.includes("OWNER") || roleText.includes("PROPRI") || roleText.includes("ADMIN")) return "FULL";
    if (roleText.includes("MANAGER") || roleText.includes("GERANT") || roleText.includes("GÉRANT")) return "MANAGER";
    if (roleText.includes("CASHIER") || roleText.includes("CAISSIER")) return "CASHIER";
    if (roleText.includes("STOCK") || roleText.includes("INVENT")) return "STOCK";
    if (roleText.includes("OBSERVER") || roleText.includes("OBSERVATEUR") || roleText.includes("READ")) return "OBSERVER";

    const permissions = new Set(user?.permissions ?? []);
    if (permissions.has("pos.sell") && !permissions.has("products.view") && !permissions.has("inventory.view")) return "CASHIER";
    if (permissions.has("inventory.view") && !permissions.has("pos.sell")) return "STOCK";
    if (permissions.has("reports.view") || permissions.has("reports.read")) return "OBSERVER";
    return "BASIC";
  }

  private restrictSummaryForAccess<T extends {
    kpis: Record<string, unknown>;
    performance: Record<string, unknown>;
    charts: Record<string, unknown>;
    recentActivity: unknown[];
    alerts: unknown[];
    topSalesTable: unknown[];
  }>(result: T, access: DashboardAccess): T {
    if (access === "FULL" || access === "MANAGER") return result;

    const scoped = {
      ...result,
      dashboardScope: access,
      kpis: { ...result.kpis },
      performance: { ...result.performance },
      charts: { ...result.charts },
      recentActivity: [],
      alerts: [],
      topSalesTable: []
    };
    const salesKpis = ["revenueToday", "revenueMonth", "profitMonth", "salesToday", "salesTotal", "customersTotal", "invoicesPaid", "invoicesUnpaid", "pendingOrders"];
    const stockKpis = ["productsTotal", "outOfStock", "lowStock"];
    const salesPerformance = ["businessValue", "salePotentialValue", "potentialKnownMargin", "estimatedProfit", "profitReliable", "missingCostSaleLines", "revenueWithoutCost", "costCoverageRate", "averageMargin", "averageOrderValue", "averageDailySales", "monthlyGrowth", "annualGrowth"];

    if (access === "STOCK") {
      for (const key of salesKpis) scoped.kpis[key] = key === "profitMonth" ? null : 0;
      for (const key of salesPerformance) scoped.performance[key] = ["estimatedProfit", "averageMargin", "monthlyGrowth", "annualGrowth"].includes(key) ? null : 0;
      scoped.charts = { ...scoped.charts, trend30Days: [], profitEvolution: [], revenueEvolution: [], weeklySales: [], topProducts: [], salesByCategory: [], paymentMethods: [], customerEvolution: [] };
      return scoped as T;
    }

    for (const key of [...salesKpis, ...stockKpis]) scoped.kpis[key] = key === "profitMonth" ? null : 0;
    for (const key of ["stockValue", "knownStockValue", "businessValue", "salePotentialValue", "potentialKnownMargin", "estimatedProfit", "profitReliable", "missingCostProducts", "missingCostSaleLines", "revenueWithoutCost", "costCoverageRate", "averageMargin", "averageOrderValue", "averageDailySales", "monthlyGrowth", "annualGrowth"]) {
      scoped.performance[key] = ["estimatedProfit", "averageMargin", "monthlyGrowth", "annualGrowth"].includes(key) ? null : 0;
    }
    scoped.charts = { trend30Days: [], profitEvolution: [], revenueEvolution: [], weeklySales: [], topProducts: [], salesByCategory: [], paymentMethods: [], customerEvolution: [], stockValueByCategory: [] };
    return scoped as T;
  }

  private buildTrend(startDate: Date, sales: Array<{ id: string; total: Prisma.Decimal; createdAt: Date }>, saleItems: SaleItemForProfit[], customers: Array<{ createdAt: Date }>, timeZone: string): TrendPoint[] {
    const days = new Map<string, TrendPoint>();
    for (let index = 0; index < 30; index += 1) {
      const date = addBusinessDays(startDate, index, timeZone);
      const key = businessDateKey(date, timeZone);
      days.set(key, { date: key, sales: 0, revenue: 0, profit: 0, customers: 0, revenueWithoutCost: 0, missingCostLines: 0 });
    }
    for (const sale of sales) {
      const point = days.get(businessDateKey(sale.createdAt, timeZone));
      if (!point) continue;
      point.sales += 1;
      point.revenue += this.money(sale.total);
    }
    for (const item of saleItems) {
      const point = days.get(businessDateKey(item.sale.createdAt, timeZone));
      if (!point) continue;
      const revenue = this.money(item.total);
      if (!item.product) {
        point.revenueWithoutCost += revenue;
        point.missingCostLines += 1;
        continue;
      }
      const cost = knownUnitCost(item.product);
      if (!cost.known || cost.amount === null) {
        point.revenueWithoutCost += revenue;
        point.missingCostLines += 1;
        continue;
      }
      point.profit = (point.profit ?? 0) + revenue - cost.amount * item.quantity;
    }
    for (const point of days.values()) if (point.missingCostLines > 0) point.profit = null;
    for (const customer of customers) {
      const point = days.get(businessDateKey(customer.createdAt, timeZone));
      if (point) point.customers += 1;
    }
    return Array.from(days.values()).map((point) => ({ ...point, revenue: this.round(point.revenue), profit: point.profit === null ? null : this.round(point.profit), revenueWithoutCost: this.round(point.revenueWithoutCost) }));
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

  private topProducts(items: SaleItemForProfit[]) {
    const rows = new Map<string, { product: string; sku: string; quantity: number; revenue: number; profit: number | null; revenueWithoutCost: number; missingCostLines: number }>();
    for (const item of items) {
      if (!item.productId || !item.product) continue;
      const current = rows.get(item.productId) ?? { product: item.product.name ?? "Produit", sku: item.product.sku ?? "-", quantity: 0, revenue: 0, profit: 0, revenueWithoutCost: 0, missingCostLines: 0 };
      const revenue = this.money(item.total);
      current.quantity += item.quantity;
      current.revenue += revenue;
      const cost = knownUnitCost(item.product);
      if (!cost.known || cost.amount === null) {
        current.profit = null;
        current.revenueWithoutCost += revenue;
        current.missingCostLines += 1;
      } else if (current.profit !== null) {
        current.profit += revenue - cost.amount * item.quantity;
      }
      rows.set(item.productId, current);
    }
    return Array.from(rows.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((row) => ({ ...row, revenue: this.round(row.revenue), profit: row.profit === null ? null : this.round(row.profit), revenueWithoutCost: this.round(row.revenueWithoutCost) }));
  }

  private salesByCategory(items: SaleItemForProfit[]) {
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

  private stockValueByCategory(products: Array<{ category?: { name: string } | null; purchasePrice: Prisma.Decimal; averageCost: Prisma.Decimal; stocks: Array<{ quantity: number; reserved?: number | null }> }>) {
    const rows = new Map<string, number>();
    for (const product of products) {
      const category = product.category?.name ?? "Sans catégorie";
      const quantity = product.stocks.reduce((sum, stock) => sum + availableStock(stock), 0);
      const cost = knownUnitCost(product);
      rows.set(category, (rows.get(category) ?? 0) + (cost.known && cost.amount !== null ? quantity * cost.amount : 0));
    }
    return Array.from(rows.entries()).map(([label, value]) => ({ label, value: this.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8);
  }

  private emptySummary() {
    return {
      databaseAvailable: false,
      dashboardScope: "BASIC",
      generatedAt: new Date().toISOString(),
      kpis: { revenueToday: 0, revenueMonth: 0, profitMonth: null, profitReliable: false, costIncompleteMessage: "Données de coût incomplètes", salesToday: 0, salesTotal: 0, customersTotal: 0, productsTotal: 0, outOfStock: 0, lowStock: 0, invoicesPaid: 0, invoicesUnpaid: 0, pendingOrders: 0 },
      performance: { stockValue: 0, knownStockValue: 0, salePotentialValue: 0, potentialKnownMargin: 0, stockValuePartial: false, missingCostProducts: 0, businessValue: 0, estimatedProfit: null, profitReliable: false, missingCostSaleLines: 0, revenueWithoutCost: 0, costCoverageRate: 0, averageMargin: null, averageOrderValue: 0, averageDailySales: 0, monthlyGrowth: 0, monthlyGrowthLabel: "0 %", annualGrowth: 0, annualGrowthLabel: "0 %" },
      charts: { trend30Days: [], profitEvolution: [], revenueEvolution: [], weeklySales: [], topProducts: [], salesByCategory: [], paymentMethods: [], customerEvolution: [], stockValueByCategory: [] },
      recentActivity: [],
      alerts: [{ type: "Base de données", message: "Impossible de charger les données du tableau de bord.", severity: "critical" }],
      topSalesTable: []
    };
  }

  private growthValue(current: number, previous: number) {
    if (previous > 0) {
      const value = this.round(((current - previous) / previous) * 100);
      return { value, label: `${value} %` };
    }
    if (current > 0) return { value: null, label: "Nouvelle activit\u00e9" };
    if (current === 0 && previous === 0) return { value: 0, label: "0 %" };
    return { value: null, label: "Non calculable" };
  }

  private async tenantTimeZone(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true, settings: { select: { timezone: true } }, companyProfile: { select: { timezone: true } } }
    });
    return normalizeBusinessTimeZone(tenant?.settings?.timezone ?? tenant?.companyProfile?.timezone ?? tenant?.timezone);
  }

  private money(value: Prisma.Decimal | number | string | null | undefined) { return Number(value ?? 0); }
  private sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
  private round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
}

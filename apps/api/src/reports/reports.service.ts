import { Injectable } from "@nestjs/common";
import { Prisma, SaleStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { availableStock, countLowStockProducts, countUnknownCostProducts, isLowStock, knownUnitCost, stockValue, sumKnownStockValue } from "../common/stock-business-rules";
import { businessDayRangeForDateKey } from "../common/business-timezone";
import { ReportQueryDto } from "./dto/report-query.dto";

type DateRange = { gte?: Date; lt?: Date };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(tenantId: string, query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const where: Prisma.SaleWhereInput = {
      tenantId,
      ...(createdAt ? { createdAt } : {})
    };
    const pagination = this.pagination(query);

    const [total, rows, aggregate, statusRows] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: { customer: true, items: true, payments: true },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.sale.aggregate({
        where,
        _sum: { subtotal: true, discount: true, tax: true, total: true }
      }),
      this.prisma.sale.groupBy({ by: ["status"], where, orderBy: { status: "asc" }, _count: true, _sum: { total: true } })
    ]);

    return {
      summary: {
        count: total,
        subtotal: this.money(aggregate._sum.subtotal),
        discount: this.money(aggregate._sum.discount),
        tax: this.money(aggregate._sum.tax),
        total: this.money(aggregate._sum.total),
        byStatus: statusRows.map((row) => ({ status: row.status, count: row._count, total: this.money(row._sum?.total) }))
      },
      items: rows.map((sale) => ({
        id: sale.id,
        customer: sale.customer?.displayName ?? "Client comptoir",
        status: sale.status,
        subtotal: this.money(sale.subtotal),
        discount: this.money(sale.discount),
        tax: this.money(sale.tax),
        total: this.money(sale.total),
        items: sale.items.length,
        payments: sale.payments.length,
        createdAt: sale.createdAt
      })),
      meta: this.meta(total, pagination)
    };
  }

  async products(tenantId: string, query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(createdAt ? { createdAt } : {})
    };
    const pagination = this.pagination(query);

    const [total, active, inactive, rows, categories, brands] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.count({ where: { ...where, isActive: true } }),
      this.prisma.product.count({ where: { ...where, isActive: false } }),
      this.prisma.product.findMany({
        where,
        include: { category: true, brand: true, unit: true, stocks: true, barcodes: true, images: true },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.category.count({ where: { tenantId } }),
      this.prisma.brand.count({ where: { tenantId } })
    ]);

    return {
      summary: { count: total, active, inactive, categories, brands },
      items: rows.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category?.name ?? null,
        brand: product.brand?.name ?? null,
        unit: product.unit?.name ?? null,
        salePrice: this.money(product.salePrice),
        purchasePrice: this.money(product.purchasePrice),
        stock: product.stocks.reduce((sum, stock) => sum + availableStock(stock), 0),
        costKnown: knownUnitCost(product).known,
        unitCost: knownUnitCost(product).amount,
        stockValue: product.stocks.reduce((sum, stock) => sum + (stockValue(stock, product) ?? 0), 0),
        minimumStock: product.minimumStock,
        barcodes: product.barcodes.length,
        images: product.images.length,
        isActive: product.isActive,
        createdAt: product.createdAt
      })),
      meta: this.meta(total, pagination)
    };
  }

  /** Lecture seule : classement des produits les plus vendus sur la periode (aucune ecriture stock/ventes/paiements). */
  async topProducts(tenantId: string, query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 10)));

    const rows = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId,
          status: { not: SaleStatus.CANCELLED },
          ...(createdAt ? { createdAt } : {})
        }
      },
      select: {
        saleId: true,
        productId: true,
        customName: true,
        quantity: true,
        total: true,
        product: { select: { name: true, sku: true } }
      }
    });

    const grouped = new Map<string, { key: string; name: string; sku: string | null; quantity: number; revenue: number; saleIds: Set<string> }>();
    for (const row of rows) {
      const key = row.productId ?? `custom:${row.customName ?? "Article personnalisé"}`;
      const existing = grouped.get(key) ?? {
        key,
        name: row.product?.name ?? row.customName ?? "Article personnalisé",
        sku: row.product?.sku ?? null,
        quantity: 0,
        revenue: 0,
        saleIds: new Set<string>()
      };
      existing.quantity += row.quantity;
      existing.revenue += Number(row.total);
      existing.saleIds.add(row.saleId);
      grouped.set(key, existing);
    }

    const ranked = [...grouped.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)
      .map((entry) => ({
        name: entry.name,
        sku: entry.sku,
        quantitySold: entry.quantity,
        revenue: this.money(entry.revenue),
        salesCount: entry.saleIds.size
      }));

    return {
      items: ranked,
      meta: { total: grouped.size, limit }
    };
  }

  async inventory(tenantId: string, query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const pagination = this.pagination(query);
    const stockWhere: Prisma.StockWhereInput = { tenantId };
    const movementWhere: Prisma.InventoryMovementWhereInput = {
      tenantId,
      ...(createdAt ? { createdAt } : {})
    };

    const [total, rows, allStocks, movements, warehouses] = await this.prisma.$transaction([
      this.prisma.stock.count({ where: stockWhere }),
      this.prisma.stock.findMany({
        where: stockWhere,
        include: { product: true, warehouse: true },
        orderBy: { updatedAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.stock.findMany({
        where: stockWhere,
        include: { product: true, warehouse: true }
      }),
      this.prisma.inventoryMovement.findMany({
        where: movementWhere,
        include: { product: true, warehouse: true },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      this.prisma.warehouse.count({ where: { tenantId, isActive: true } })
    ]);

    const lowStockProductCount = countLowStockProducts(allStocks);
    const totalQuantity = allStocks.reduce((sum, stock) => sum + stock.quantity, 0);
    const totalReserved = allStocks.reduce((sum, stock) => sum + stock.reserved, 0);
    const totalAvailable = allStocks.reduce((sum, stock) => sum + availableStock(stock), 0);
    const totalStockValue = sumKnownStockValue(allStocks);
    const stockValueUnknownCosts = countUnknownCostProducts(allStocks);

    return {
      summary: {
        stockLines: total,
        warehouses,
        quantity: totalQuantity,
        reserved: totalReserved,
        available: totalAvailable,
        lowStock: lowStockProductCount,
        stockValue: this.money(totalStockValue),
        stockValueUnknownCosts,
        movements: movements.length
      },
      items: rows.map((stock) => ({
        id: stock.id,
        product: stock.product.name,
        sku: stock.product.sku,
        warehouse: stock.warehouse.name,
        quantity: stock.quantity,
        reserved: stock.reserved,
        available: availableStock(stock),
        minimumStock: stock.minimumStock,
        isLowStock: isLowStock(stock),
        costKnown: knownUnitCost(stock.product).known,
        stockValue: stockValue(stock, stock.product),
        updatedAt: stock.updatedAt
      })),
      recentMovements: movements.map((movement) => ({
        id: movement.id,
        product: movement.product.name,
        warehouse: movement.warehouse.name,
        type: movement.type,
        quantity: movement.quantity,
        beforeQty: movement.beforeQty,
        afterQty: movement.afterQty,
        createdAt: movement.createdAt
      })),
      meta: this.meta(total, pagination)
    };
  }

  async customers(tenantId: string, query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(createdAt ? { createdAt } : {})
    };
    const pagination = this.pagination(query);

    const [total, rows, balance, statusRows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.customer.aggregate({ where, _sum: { currentBalance: true, creditLimit: true } }),
      this.prisma.customer.groupBy({ by: ["status"], where, orderBy: { status: "asc" }, _count: true })
    ]);

    return {
      summary: {
        count: total,
        currentBalance: this.money(balance._sum.currentBalance),
        creditLimit: this.money(balance._sum.creditLimit),
        byStatus: statusRows.map((row) => ({ status: row.status, count: row._count }))
      },
      items: rows.map((customer) => ({
        id: customer.id,
        code: customer.customerCode,
        name: customer.displayName,
        company: customer.company,
        phone: customer.phone ?? customer.mobile ?? customer.whatsapp,
        email: customer.email,
        city: customer.city,
        currentBalance: this.money(customer.currentBalance),
        creditLimit: this.money(customer.creditLimit),
        status: customer.status,
        createdAt: customer.createdAt
      })),
      meta: this.meta(total, pagination)
    };
  }

  async purchases(tenantId: string, query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      ...(createdAt ? { createdAt } : {})
    };
    const pagination = this.pagination(query);

    const [total, rows, aggregate, statusRows, receipts] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true, items: true, receipts: true },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit
      }),
      this.prisma.purchaseOrder.aggregate({ where, _sum: { subtotal: true, tax: true, total: true } }),
      this.prisma.purchaseOrder.groupBy({ by: ["status"], where, orderBy: { status: "asc" }, _count: true, _sum: { total: true } }),
      this.prisma.goodsReceipt.count({ where: { tenantId, ...(createdAt ? { createdAt } : {}) } })
    ]);

    return {
      summary: {
        count: total,
        subtotal: this.money(aggregate._sum.subtotal),
        tax: this.money(aggregate._sum.tax),
        total: this.money(aggregate._sum.total),
        receipts,
        byStatus: statusRows.map((row) => ({ status: row.status, count: row._count, total: this.money(row._sum?.total) }))
      },
      items: rows.map((purchase) => ({
        id: purchase.id,
        number: purchase.number,
        supplier: purchase.supplier.name,
        status: purchase.status,
        subtotal: this.money(purchase.subtotal),
        tax: this.money(purchase.tax),
        total: this.money(purchase.total),
        items: purchase.items.length,
        receipts: purchase.receipts.length,
        createdAt: purchase.createdAt
      })),
      meta: this.meta(total, pagination)
    };
  }

  async profit(tenantId: string, query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const saleWhere: Prisma.SaleWhereInput = {
      tenantId,
      status: SaleStatus.COMPLETED,
      ...(createdAt ? { createdAt } : {})
    };

    const [salesAggregate, saleItems, purchaseAggregate, returnsAggregate] = await this.prisma.$transaction([
      this.prisma.sale.aggregate({ where: saleWhere, _sum: { total: true, discount: true, tax: true } }),
      this.prisma.saleItem.findMany({
        where: { sale: saleWhere },
        include: { product: true, sale: true },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { tenantId, ...(createdAt ? { createdAt } : {}) },
        _sum: { total: true }
      }),
      this.prisma.salesReturn.aggregate({
        where: { tenantId, ...(createdAt ? { createdAt } : {}) },
        _sum: { total: true }
      })
    ]);

    const revenue = this.money(salesAggregate._sum.total);
    const tax = this.money(salesAggregate._sum.tax);
    const discount = this.money(salesAggregate._sum.discount);
    let knownRevenue = 0;
    let revenueWithoutCost = 0;
    let costUnknownItems = 0;
    const costOfGoods = saleItems.reduce((sum, item) => {
      const lineRevenue = this.money(item.total);
      if (!item.product) {
        revenueWithoutCost += lineRevenue;
        costUnknownItems += 1;
        return sum;
      }
      const cost = knownUnitCost(item.product);
      if (!cost.known || cost.amount === null) {
        revenueWithoutCost += lineRevenue;
        costUnknownItems += 1;
        return sum;
      }
      knownRevenue += lineRevenue;
      return sum + cost.amount * item.quantity;
    }, 0);
    const returns = this.money(returnsAggregate._sum.total);
    const purchases = this.money(purchaseAggregate._sum.total);
    const grossProfit = knownRevenue > 0 ? knownRevenue - costOfGoods : null;
    const costCoverageRate = revenue > 0 ? Number(((knownRevenue / revenue) * 100).toFixed(2)) : 100;

    return {
      summary: {
        revenue,
        tax,
        discount,
        costOfGoods,
        costUnknownItems,
        knownRevenue,
        revenueWithoutCost,
        revenueExcludedFromProfit: revenueWithoutCost,
        costCoverageRate,
        returns,
        purchases,
        grossProfit,
        marginRate: grossProfit === null ? null : knownRevenue > 0 ? Number(((grossProfit / knownRevenue) * 100).toFixed(2)) : null,
        marginReliable: costUnknownItems === 0,
        profitScope: costUnknownItems === 0 ? "COMPLETE" : knownRevenue > 0 ? "PARTIAL" : "UNKNOWN"
      },
      items: saleItems.map((item) => {
        const cost = item.product ? knownUnitCost(item.product) : { known: false, amount: null };
        const revenueLine = this.money(item.total);
        const costLine = cost.known && cost.amount !== null ? cost.amount * item.quantity : null;
        return {
          id: item.id,
          product: item.product?.name ?? item.customName ?? "Article personnalise",
          sku: item.product?.sku ?? "PERSONNALISE",
          quantity: item.quantity,
          revenue: revenueLine,
          cost: costLine,
          costKnown: cost.known,
          profit: costLine === null ? null : revenueLine - costLine,
          createdAt: item.createdAt
        };
      }),
      meta: this.meta(saleItems.length, { page: 1, limit: saleItems.length || 1, skip: 0 })
    };
  }

  async dashboard(tenantId: string, query: ReportQueryDto) {
    const [sales, products, inventory, customers, purchases, profit] = await Promise.all([
      this.sales(tenantId, { ...query, page: 1, limit: 5 }),
      this.products(tenantId, { ...query, page: 1, limit: 5 }),
      this.inventory(tenantId, { ...query, page: 1, limit: 5 }),
      this.customers(tenantId, { ...query, page: 1, limit: 5 }),
      this.purchases(tenantId, { ...query, page: 1, limit: 5 }),
      this.profit(tenantId, query)
    ]);

    return { sales, products, inventory, customers, purchases, profit };
  }

  private dateRange(query: ReportQueryDto): DateRange | undefined {
    const range: DateRange = {};
    if (query.dateFrom) {
      range.gte = businessDayRangeForDateKey(query.dateFrom).start;
    }
    if (query.dateTo) {
      range.lt = businessDayRangeForDateKey(query.dateTo).end;
    }
    return Object.keys(range).length ? range : undefined;
  }

  private pagination(query: ReportQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    return { page, limit, skip: (page - 1) * limit };
  }

  private meta(total: number, pagination: { page: number; limit: number; skip: number }) {
    return {
      total,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.max(1, Math.ceil(total / pagination.limit))
    };
  }

  private money(value: Prisma.Decimal | number | string | null | undefined) {
    return Number(value ?? 0);
  }
}

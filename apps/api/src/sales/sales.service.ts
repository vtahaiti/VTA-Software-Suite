import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, PaymentMethod, Prisma, SaleStatus, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import type { AuthUser } from "../auth/types/auth-user";
import { businessDayRange, businessMonthRange, businessWeekRange, businessDayRangeForDateKey } from "../common/business-timezone";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { SaleQueryDto } from "./dto/sale-query.dto";

type SaleProduct = Prisma.ProductGetPayload<{ include: { variants: true; stocks: true } }>;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService, private readonly stock: StockService) {}

  async findAll(tenantId: string, query: SaleQueryDto, user?: Pick<AuthUser, "id" | "role" | "roles" | "permissions">) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const access = this.saleAccess(user);
    const where = await this.saleWhere(tenantId, query, access);
    const saleListSelect = {
      id: true,
      status: true,
      total: true,
      createdAt: true,
      createdById: true,
      customer: { select: { displayName: true, phone: true } },
      receipt: { select: { number: true } },
      payments: { select: { amount: true, receivedAmount: true, changeAmount: true, invoice: { select: { status: true } } } }
    } satisfies Prisma.SaleSelect;
    const summaryWhere = { ...where, status: SaleStatus.COMPLETED, cancelledAt: null, returnedAt: null, payments: { some: { invoice: { status: SalesDocumentStatus.PAID } } } } satisfies Prisma.SaleWhereInput;
    const [items, total, summarySales] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        select: saleListSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({ where: summaryWhere, select: { total: true, payments: { select: { amount: true, receivedAmount: true, changeAmount: true } } } })
    ]);
    const cashiers = await this.cashierOptions(tenantId, access);
    const cashierIds = [...new Set(items.map((item) => item.createdById).filter((id): id is string => Boolean(id)))];
    const creators = cashierIds.length ? await this.prisma.user.findMany({ where: { tenantId, id: { in: cashierIds } }, select: { id: true, name: true, isActive: true } }) : [];
    const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));
    return {
      items: items.map((item) => ({
        ...item,
        createdByUserId: item.createdById,
        createdByUserName: item.createdById ? creatorMap.get(item.createdById)?.name ?? "Utilisateur supprimé" : null
      })),
      summary: this.salesSummary(summarySales),
      cashiers,
      meta: { page, limit, total, pageCount: Math.ceil(total / limit) }
    };
  }

  async findOne(tenantId: string, id: string, user?: Pick<AuthUser, "id" | "role" | "roles" | "permissions">) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: { include: { product: true } }, payments: { include: { invoice: true } }, receipt: true, customer: true, cashSession: { include: { cashRegister: true } } }
    });
    if (!sale) throw new NotFoundException("Vente introuvable");
    if (user) {
      const access = this.saleAccess(user);
      if (access.forcedUserId && sale.createdById !== access.forcedUserId) {
        throw new ForbiddenException("Accès interdit à la vente d'un autre caissier");
      }
    }
    return sale;
  }

  async create(tenantId: string, dto: CreateSaleDto, userId?: string) {
    if (!dto.items?.length) throw new BadRequestException("Panier vide");

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        const customer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId } });
        if (!customer) throw new NotFoundException("Client introuvable");
      }

      if (dto.storeId) {


        const store = await tx.store.findFirst({ where: { id: dto.storeId, tenantId, status: "ACTIVE" } });


        if (!store) throw new NotFoundException("Magasin introuvable");


      }



      const warehouse = await tx.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId, isActive: true } });
      if (!warehouse) throw new NotFoundException("Entrepôt introuvable");

      if (dto.cashSessionId) {
        const session = await tx.cashSession.findFirst({ where: { id: dto.cashSessionId, tenantId, status: "OPEN" } });
        if (!session) throw new BadRequestException("Session caisse fermee ou introuvable");
      }

      const productIds = [...new Set(dto.items.map((item) => item.productId).filter((productId): productId is string => Boolean(productId)))];
      const products = await tx.product.findMany({ where: { tenantId, id: { in: productIds }, isActive: true }, include: { variants: true, stocks: true } });
      const productMap = new Map(products.map((product) => [product.id, product]));
      const taxRate = dto.taxRate ?? 0;
      const orderDiscount = dto.discount ?? 0;
      let subtotal = 0;
      let itemTax = 0;

      const saleItems = dto.items.map((item) => {
        let product: SaleProduct | null = null;
        let unitPrice = Number(item.unitPrice ?? NaN);
        let customName: string | undefined;
        if (item.productId) {
          product = productMap.get(item.productId) ?? null;
          if (!product) throw new NotFoundException("Produit introuvable");
          unitPrice = Number(product.salePrice);
        } else {
          customName = item.customName?.trim();
          if (!customName) throw new BadRequestException("Le nom de l'article personnalisé est obligatoire");
          if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new BadRequestException("Le prix de l'article personnalisé est obligatoire");
        }
        const lineSubtotal = unitPrice * item.quantity;
        const discount = item.discount ?? 0;
        const taxable = lineSubtotal - discount;
        if (taxable < 0) throw new BadRequestException("Remise supérieure au montant de la ligne");
        const tax = this.round(taxable * taxRate);
        const total = this.round(taxable + tax);
        subtotal += lineSubtotal;
        itemTax += tax;
        return {
          product,
          productId: item.productId,
          customName,
          customType: item.customType,
          customNote: item.customNote,
          quantity: item.quantity,
          unitPrice,
          discount,
          tax,
          total
        };
      });

      const grossTotal = saleItems.reduce((sum, item) => sum + item.total, 0);
      const total = this.round(grossTotal - orderDiscount);
      if (total < 0) throw new BadRequestException("Remise supérieure au total");

      const payments = dto.payments ?? [];
      const receivedAmount = this.round(payments.reduce((sum, payment) => sum + payment.amount, 0));
      if (receivedAmount < total) {
        throw new BadRequestException(this.insufficientPaymentMessage(total, receivedAmount));
      }
      if (receivedAmount > total && payments.some((payment) => payment.method !== "CASH")) {
        throw new BadRequestException("Le trop-perçu est autorisé uniquement en espèces");
      }
      const settledAmount = this.round(Math.min(receivedAmount, total));
      const changeAmount = this.round(Math.max(0, receivedAmount - total));
      const paymentRows = this.paymentRows(payments, total);

      for (const item of saleItems) {
        if (!item.productId || !item.product) continue;
        const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: item.productId, warehouseId: dto.warehouseId } } });
        if (!this.isStockTrackedProduct(item.product)) continue;
        const available = (stock?.quantity ?? 0) - (stock?.reserved ?? 0);
        if (!stock || available < item.quantity) throw new BadRequestException(`Stock insuffisant pour ${item.product.name}`);
      }

      const sale = await tx.sale.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          storeId: dto.storeId,
          cashSessionId: dto.cashSessionId,
          createdById: userId,
          subtotal: this.round(subtotal),
          discount: this.round(orderDiscount),
          tax: this.round(itemTax),
          total,
          note: dto.note,
          status: SaleStatus.COMPLETED,
          items: { create: saleItems.map((item) => this.saleLineData(item)) }
        }
      });

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          documentNumber: this.documentNumber("INV"),
          status: settledAmount >= total ? SalesDocumentStatus.PAID : SalesDocumentStatus.PARTIALLY_PAID,
          subtotal: this.round(subtotal),
          discount: this.round(orderDiscount),
          tax: this.round(itemTax),
          total,
          paidAmount: settledAmount,
          balance: this.round(Math.max(0, total - settledAmount)),
          notes: dto.note,
          createdById: userId,
          issuedAt: new Date(),
          items: { create: saleItems.map((item) => this.saleLineData(item)) }
        }
      });

      for (const payment of paymentRows) {
        await tx.payment.create({ data: { saleId: sale.id, invoiceId: invoice.id, method: payment.method, amount: payment.amount, receivedAmount: payment.receivedAmount, changeAmount: payment.changeAmount, reference: payment.reference } });
      }

      if (dto.cashSessionId && settledAmount > 0) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: dto.cashSessionId,
            type: "IN",
            amount: settledAmount,
            reason: settledAmount >= total ? "Encaissement vente POS" : "Acompte vente POS",
            reference: sale.id
          }
        });
      }

      for (const item of saleItems) {
        if (!item.productId || !item.product) continue;
        const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: item.productId, warehouseId: dto.warehouseId } } });
        if (!this.isStockTrackedProduct(item.product)) continue;
        if (!stock) throw new BadRequestException(`Stock insuffisant pour ${item.product.name}`);
        const afterQty = stock.quantity - item.quantity;
        if (afterQty < 0) throw new BadRequestException(`Stock insuffisant pour ${item.product.name}`);
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: afterQty } });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            warehouseId: dto.warehouseId,
            type: InventoryMovementType.SALE,
            userId,
            storeId: dto.storeId,
            quantity: item.quantity,
            beforeQty: stock.quantity,
            afterQty,
            reference: sale.id,
            note: "Vente POS"
          }
        });
      }

      const receiptNumber = await this.nextReceiptNumber(tx, tenantId);
      const receipt = await tx.receipt.create({
        data: {
          saleId: sale.id,
          number: receiptNumber,
          content: this.receiptContent(receiptNumber, saleItems, total, settledAmount, receivedAmount, changeAmount)
        }
      });

      return { saleId: sale.id, invoiceId: invoice.id, receiptId: receipt.id };
    });

    const sale = await this.findOne(tenantId, result.saleId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id: result.invoiceId }, include: { items: { include: { product: true } }, payments: true } });
    return { ...sale, invoice };
  }

  async cancel(tenantId: string, id: string, userId?: string) {
    const sale = await this.findOne(tenantId, id);
    if (sale.status !== SaleStatus.COMPLETED) throw new BadRequestException("Vente non annulable");
    return this.prisma.$transaction(async (tx) => {
      const saleMovements = await tx.inventoryMovement.findMany({ where: { tenantId, reference: sale.id, type: InventoryMovementType.SALE } });
      for (const movement of saleMovements) {
        const stock = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId: movement.productId, warehouseId: movement.warehouseId } } });
        if (!stock) throw new NotFoundException("Stock introuvable pour annulation");
        const afterQty = stock.quantity + movement.quantity;
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: afterQty } });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: movement.productId,
            warehouseId: movement.warehouseId,
            type: InventoryMovementType.CANCEL_SALE,
            userId,
            storeId: movement.storeId,
            quantity: movement.quantity,
            beforeQty: stock.quantity,
            afterQty,
            reference: sale.id,
            note: "Annulation vente",
            reason: "Annulation vente"
          }
        });
      }
      return tx.sale.update({ where: { id }, data: { status: SaleStatus.CANCELLED, cancelledAt: new Date() } });
    });
  }

  async returnSale(tenantId: string, id: string, warehouseId: string, userId?: string) {
    const sale = await this.findOne(tenantId, id);
    if (sale.status === SaleStatus.RETURNED) throw new BadRequestException("Vente déjà retournée");
    for (const item of sale.items) {
      if (!item.productId) continue;
      await this.stock.returnStock(tenantId, { productId: item.productId, warehouseId, quantity: item.quantity, reference: sale.id, note: "Retour produit", userId, storeId: sale.storeId ?? undefined });
    }
    return this.prisma.sale.update({ where: { id }, data: { status: SaleStatus.RETURNED, returnedAt: new Date() } });
  }

  private saleLineData(item: { productId?: string; customName?: string; customType?: string; customNote?: string; quantity: number; unitPrice: number; discount: number; tax: number; total: number }) {
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

  private isStockTrackedProduct(product: Pick<SaleProduct, "minimumStock"> & { stocks?: unknown[]; variants?: Array<{ name?: string | null; model?: string | null }> }) {
    const variantText = (product.variants ?? []).map((variant) => `${variant.name ?? ""} ${variant.model ?? ""}`).join(" ").toLowerCase();
    if (/non stock|non-stock|sans suivi|service non stock|produit non stock|plat \/ service/.test(variantText)) return false;
    return Number(product.minimumStock ?? 0) > 0 || Number(product.stocks?.length ?? 0) > 0;
  }

  private receiptContent(receiptNumber: string, items: Array<{ product: { name: string } | null; customName?: string; productId?: string; quantity: number; total: number }>, total: number, settledAmount: number, receivedAmount: number, changeAmount: number) {
    const lines = items.map((item) => {
      const name = item.product?.name ?? item.customName ?? "Article personnalisé";
      const suffix = item.productId ? "" : " (Article personnalisé)";
      return `${name}${suffix} x${item.quantity} ${item.total.toFixed(2)}`;
    }).join("\n");
    const balance = Math.max(0, total - settledAmount);
    return `Ticket de vente\nReçu ${this.displayReceiptNumber(receiptNumber)}\n${lines}\nTotal: ${total.toFixed(2)}\nMontant règle: ${settledAmount.toFixed(2)}\nMontant reçu: ${receivedAmount.toFixed(2)}\nMonnaie rendue: ${changeAmount.toFixed(2)}\nSolde: ${balance.toFixed(2)}`;
  }

  private async nextReceiptNumber(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`receipt:${tenantId}`}))`.catch(() => undefined);
    const prefix = this.receiptTenantPrefix(tenantId);
    const count = await tx.receipt.count({
      where: {
        number: { startsWith: prefix },
        sale: { tenantId }
      }
    });
    return `${prefix}${String(count + 1).padStart(5, "0")}`;
  }

  private receiptTenantPrefix(tenantId: string) {
    return `${tenantId}-`;
  }

  private displayReceiptNumber(receiptNumber: string) {
    const match = receiptNumber.match(/^[a-z0-9]{10,}-(\d{5,})$/i);
    return match?.[1] ?? receiptNumber;
  }

  private paymentRows(payments: Array<{ method: PaymentMethod; amount: number; reference?: string }>, total: number) {
    let remaining = this.round(total);
    let overpaymentAssigned = false;
    return payments
      .filter((payment) => payment.amount > 0)
      .map((payment) => {
        const receivedAmount = this.round(payment.amount);
        const settledAmount = this.round(Math.min(receivedAmount, remaining));
        remaining = this.round(Math.max(0, remaining - settledAmount));
        const changeAmount = !overpaymentAssigned && payment.method === "CASH" && receivedAmount > settledAmount ? this.round(receivedAmount - settledAmount) : 0;
        if (changeAmount > 0) overpaymentAssigned = true;
        return { method: payment.method, amount: settledAmount, receivedAmount, changeAmount, reference: payment.reference };
      })
      .filter((payment) => payment.amount > 0 || payment.receivedAmount > 0);
  }

  private documentNumber(prefix: string) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private insufficientPaymentMessage(total: number, paidAmount: number) {
    const missing = this.round(total - paidAmount);
    return `Montant insuffisant. Le client doit payer au minimum ${this.formatAmount(total)} HTG. Il manque ${this.formatAmount(missing)} HTG.`;
  }

  private formatAmount(value: number) {
    return new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(this.round(value));
  }

  private async saleWhere(tenantId: string, query: SaleQueryDto, access: SaleAccess): Promise<Prisma.SaleWhereInput> {
    const status = this.normalizeStatus(query.status);
    const where: Prisma.SaleWhereInput = { tenantId, status };
    const cashierId = query.cashierId?.trim();
    if (access.forcedUserId) {
      if (cashierId && cashierId !== "all" && cashierId !== access.forcedUserId) {
        throw new ForbiddenException("Acces interdit aux ventes d'un autre caissier");
      }
      where.createdById = access.forcedUserId;
    } else if (cashierId && cashierId !== "all") {
      where.createdById = cashierId;
    }
    const dateRange = await this.saleDateRange(tenantId, query);
    if (dateRange) where.createdAt = { gte: dateRange.start, lt: dateRange.end };
    if (status === SaleStatus.COMPLETED) {
      where.cancelledAt = null;
      where.returnedAt = null;
      where.payments = { some: { invoice: { status: SalesDocumentStatus.PAID } } };
      if (query.excludeTestData ?? true) where.NOT = this.testDataFilters();
    }
    return where;
  }

  private saleAccess(user?: Pick<AuthUser, "id" | "role" | "roles" | "permissions">): SaleAccess {
    const roles = new Set([user?.role, ...(user?.roles ?? [])].filter(Boolean).map((role) => String(role).toUpperCase()));
    const roleText = [...roles].join(" ");
    const permissions = new Set((user?.permissions ?? []).map((permission) => permission.toLowerCase()));
    const isOwnerOrAdmin = roles.has("OWNER") || roles.has("ADMIN") || roleText.includes("PROPRI") || roles.has("ADMINISTRATOR");
    const isManager = roles.has("MANAGER") || roleText.includes("GERANT") || roleText.includes("GÉRANT");
    const managerCanViewAll = isManager && (permissions.has("sales.view_all") || permissions.has("sales.view.all") || permissions.has("sales.viewall"));
    const canViewAll = isOwnerOrAdmin || managerCanViewAll;
    return { userId: user?.id, canViewAll, forcedUserId: canViewAll ? undefined : user?.id ?? "__missing_user__" };
  }

  private async cashierOptions(tenantId: string, access: SaleAccess) {
    if (!access.canViewAll) {
      const user = access.userId ? await this.prisma.user.findFirst({ where: { tenantId, id: access.userId }, select: { id: true, name: true, isActive: true } }) : null;
      return user ? [{ id: user.id, name: user.name, isActive: user.isActive }] : [];
    }
    const saleCreators = await this.prisma.sale.findMany({
      where: { tenantId, createdById: { not: null } },
      select: { createdById: true },
      distinct: ["createdById"]
    });
    const creatorIds = saleCreators.map((sale) => sale.createdById).filter((id): id is string => Boolean(id));
    return this.prisma.user.findMany({
      where: { tenantId, OR: [{ isActive: true }, { id: { in: creatorIds } }] },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" }
    });
  }

  private salesSummary(sales: Array<{ total: Prisma.Decimal | number | string; payments: Array<{ amount: Prisma.Decimal | number | string; receivedAmount: Prisma.Decimal | number | string | null; changeAmount: Prisma.Decimal | number | string | null }> }>) {
    const summary = sales.reduce((acc, sale) => {
      const total = Number(sale.total ?? 0);
      const settledAmount = sale.payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const receivedAmount = sale.payments.reduce((sum, payment) => sum + Number(payment.receivedAmount ?? payment.amount ?? 0), 0);
      const changeAmount = sale.payments.reduce((sum, payment) => sum + Number(payment.changeAmount ?? 0), 0);
      acc.count += 1;
      acc.total += total;
      acc.settledAmount += settledAmount;
      acc.receivedAmount += receivedAmount;
      acc.changeAmount += changeAmount;
      return acc;
    }, { count: 0, total: 0, settledAmount: 0, receivedAmount: 0, changeAmount: 0 });
    return {
      count: summary.count,
      total: this.round(summary.total),
      settledAmount: this.round(summary.settledAmount),
      receivedAmount: this.round(summary.receivedAmount),
      changeAmount: this.round(summary.changeAmount),
      averageBasket: summary.count ? this.round(summary.total / summary.count) : 0
    };
  }

  private async saleDateRange(tenantId: string, query: SaleQueryDto) {
    if (!query.period) return null;
    const timeZone = await this.tenantTimeZone(tenantId);
    if (query.period === "today") return businessDayRange(new Date(), timeZone);
    if (query.period === "week") return businessWeekRange(new Date(), timeZone);
    if (query.period === "month") return businessMonthRange(new Date(), timeZone);
    const startKey = query.startDate?.trim();
    const endKey = query.endDate?.trim() || startKey;
    if (!startKey || !endKey) return null;
    const start = businessDayRangeForDateKey(startKey, timeZone);
    const end = businessDayRangeForDateKey(endKey, timeZone);
    return { start: start.start, end: end.end, timeZone };
  }

  private async tenantTimeZone(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true, settings: { select: { timezone: true } } } });
    return tenant?.settings?.timezone ?? tenant?.timezone ?? undefined;
  }

  private isCompletedPaidSale(sale: Prisma.SaleGetPayload<{ include: { items: { include: { product: true } }; payments: { include: { invoice: true } }; receipt: true; customer: true; cashSession: { include: { cashRegister: true } } } }>) {
    if (sale.status !== SaleStatus.COMPLETED || sale.cancelledAt || sale.returnedAt) return false;
    const paid = sale.payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    return paid >= Number(sale.total ?? 0) && sale.payments.some((payment) => payment.invoice?.status === SalesDocumentStatus.PAID);
  }

  private uniqueSales<T extends { id: string }>(sales: T[]) {
    return [...new Map(sales.map((sale) => [sale.id, sale])).values()];
  }

  private testDataFilters(): Prisma.SaleWhereInput[] {
    const markers = ["test", "qa", "seed", "demo", "import", "smoke", "pos link", "scan test", "no cash", "nocash", "ui qa", "core logic"];
    return markers.flatMap((marker) => [
      { items: { some: { product: { name: { contains: marker, mode: "insensitive" } } } } },
      { items: { some: { product: { sku: { contains: marker, mode: "insensitive" } } } } }
    ]);
  }

  private normalizeStatus(status?: string) {
    if (!status) return undefined;
    const normalized = status.trim().toUpperCase();
    if (normalized === "PAID") return SaleStatus.COMPLETED;
    if (normalized in SaleStatus) return SaleStatus[normalized as keyof typeof SaleStatus];
    throw new BadRequestException(`Statut de vente invalide: ${normalized}. Statuts autorisés: ${this.allowedSaleStatuses().join(", ")}.`);
  }

  private allowedSaleStatuses() {
    return [...Object.keys(SaleStatus), "PAID"];
  }
}

type SaleAccess = {
  userId?: string;
  canViewAll: boolean;
  forcedUserId?: string;
};

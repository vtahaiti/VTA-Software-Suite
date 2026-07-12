import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { availableStock as computeAvailableStock } from "../common/stock-business-rules";
import { CreateCustomerDto } from "../customers/dto/create-customer.dto";
import { ProductQueryDto } from "../products/dto/product-query.dto";
import { CreateSaleDto } from "../sales/dto/create-sale.dto";
import { PosCartAddDto, PosCartDto, PosCartRemoveDto, PosCartUpdateDto } from "./dto/pos-cart.dto";

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  async context(tenantId: string) {
    await this.ensurePosContext(tenantId);
    const [stores, warehouses, sessions, history, customers] = await this.prisma.$transaction([
      this.prisma.store.findMany({ where: { tenantId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } }),
      this.prisma.warehouse.findMany({ where: { tenantId, isActive: true }, orderBy: { createdAt: "asc" } }),
      this.prisma.cashSession.findMany({ where: { tenantId, status: "OPEN" }, include: { cashRegister: true }, orderBy: { openedAt: "desc" } }),
      this.prisma.sale.findMany({
        where: { tenantId },
        include: { payments: true, receipt: true, customer: true, cashSession: { include: { cashRegister: true } } },
        orderBy: { createdAt: "desc" },
        take: 6
      }),
      this.prisma.customer.findMany({
        where: { tenantId },
        select: { id: true, displayName: true, phone: true, mobile: true, whatsapp: true },
        orderBy: { updatedAt: "desc" },
        take: 25
      })
    ]);
    return { stores, warehouses, sessions, history, customers };
  }

  private async ensurePosContext(tenantId: string) {
    const store = await this.ensureDefaultStore(tenantId);
    await this.ensureDefaultWarehouse(tenantId, store.id);
    return this.ensureOpenCashSession(tenantId, store.id);
  }

  private async ensureDefaultStore(tenantId: string) {
    const activeStore = await this.prisma.store.findFirst({ where: { tenantId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
    if (activeStore) return activeStore;

    return this.prisma.store.upsert({
      where: { tenantId_code: { tenantId, code: "MAIN" } },
      update: { status: "ACTIVE" },
      create: { tenantId, code: "MAIN", name: "Magasin principal", status: "ACTIVE" }
    });
  }

  private async ensureDefaultWarehouse(tenantId: string, storeId: string) {
    const activeWarehouse = await this.prisma.warehouse.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: "asc" } });
    if (activeWarehouse) return activeWarehouse;

    return this.prisma.warehouse.upsert({
      where: { tenantId_code: { tenantId, code: "DEPOT-PRINCIPAL" } },
      update: { storeId, status: "ACTIVE", isActive: true },
      create: { tenantId, storeId, code: "DEPOT-PRINCIPAL", name: "Dépôt principal", description: "Dépôt principal", status: "ACTIVE", isActive: true }
    });
  }

  private async ensureOpenCashSession(tenantId: string, storeId?: string) {
    const existingSession = await this.prisma.cashSession.findFirst({ where: { tenantId, status: "OPEN" } });
    if (existingSession) return existingSession;

    let cashRegister = await this.prisma.cashRegister.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: "asc" }
    });

    if (!cashRegister) {
      cashRegister = await this.prisma.cashRegister.upsert({
        where: { tenantId_code: { tenantId, code: "CAISSE-01" } },
        update: { storeId, isActive: true },
        create: { tenantId, storeId, code: "CAISSE-01", name: "Caisse principale", isActive: true }
      });
    }

    return this.prisma.cashSession.create({
      data: {
        tenantId,
        cashRegisterId: cashRegister.id,
        openingAmount: 0,
        status: "OPEN"
      },
      include: { cashRegister: true }
    });
  }

  async searchProducts(tenantId: string, query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where: Prisma.ProductWhereInput = {
      tenantId,
      isActive: true,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: "insensitive" } },
            { sku: { contains: query.search, mode: "insensitive" } },
            { barcodes: { some: { value: { contains: query.search } } } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          sku: true,
          name: true,
          salePrice: true,
          purchasePrice: true,
          barcodes: { select: { value: true, isPrimary: true } },
          images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
          stocks: { select: { warehouseId: true, quantity: true, reserved: true } },
          category: { select: { name: true } },
          brand: { select: { name: true } },
          unit: { select: { name: true, symbol: true } }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" }
      }),
      this.prisma.product.count({ where })
    ]);

    return { items: items.map((product) => this.productForPos(product, query.warehouseId)), meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async scanProduct(tenantId: string, barcode: string) {
    if (!barcode?.trim()) throw new BadRequestException("Code-barres requis");
    const product = await this.prisma.product.findFirst({
      where: { tenantId, isActive: true, barcodes: { some: { value: barcode.trim() } } },
      include: { barcodes: true, images: true, stocks: true, category: true, brand: true, unit: true }
    });
    if (!product) throw new NotFoundException("Produit introuvable pour ce code-barres");
    return this.productForPos(product);
  }

  async addToCart(tenantId: string, dto: PosCartAddDto) {
    const quantity = dto.quantity ?? 1;
    const existing = dto.items.find((item) => item.productId === dto.productId);
    const items = existing
      ? dto.items.map((item) => (item.productId === dto.productId ? { ...item, quantity: item.quantity + quantity } : item))
      : [...dto.items, { productId: dto.productId, quantity, discount: 0 }];
    return this.calculateCart(tenantId, { ...dto, items });
  }

  async updateCartItem(tenantId: string, dto: PosCartUpdateDto) {
    const items = dto.quantity === 0
      ? dto.items.filter((item) => item.productId !== dto.productId)
      : dto.items.map((item) => (item.productId === dto.productId ? { ...item, quantity: dto.quantity } : item));
    return this.calculateCart(tenantId, { ...dto, items });
  }

  async removeFromCart(tenantId: string, dto: PosCartRemoveDto) {
    return this.calculateCart(tenantId, { ...dto, items: dto.items.filter((item) => item.productId !== dto.productId) });
  }

  async calculateCart(tenantId: string, dto: PosCartDto) {
    if (!dto.items.length) return this.emptyCart(dto.taxRate ?? 0, dto.discount ?? 0);
    const productIds = dto.items.map((item) => item.productId).filter((productId): productId is string => Boolean(productId));
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds }, isActive: true },
      include: { barcodes: true, stocks: true }
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const taxRate = dto.taxRate ?? 0;
    let subtotal = 0;
    let itemDiscount = 0;
    let tax = 0;

    const items = dto.items.map((item) => {
      if (!item.productId) {
        const customName = item.customName?.trim();
        const unitPrice = Number(item.unitPrice ?? NaN);
        if (!customName) throw new BadRequestException("Le nom de l'article personnalise est obligatoire");
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new BadRequestException("Le prix de l'article personnalise est obligatoire");
        const discount = item.discount ?? 0;
        const base = unitPrice * item.quantity;
        const taxable = base - discount;
        if (taxable < 0) throw new BadRequestException("Remise superieure au montant de la ligne");
        const lineTax = taxable * taxRate;
        const total = taxable + lineTax;
        subtotal += base;
        itemDiscount += discount;
        tax += lineTax;
        return {
          customId: item.customId ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          productId: null,
          sku: "PERSONNALISE",
          name: customName,
          unitPrice,
          quantity: item.quantity,
          discount,
          tax: this.round(lineTax),
          total: this.round(total),
          availableStock: 0,
          primaryBarcode: null,
          hasEnoughStock: true,
          isCustom: true,
          customName,
          customType: item.customType ?? "OTHER",
          customNote: item.customNote
        };
      }
      const product = productMap.get(item.productId);
      if (!product) throw new NotFoundException("Produit introuvable");
      const availableStock = this.availableStock(product.stocks, dto.warehouseId);
      const unitPrice = Number(product.salePrice);
      const discount = item.discount ?? 0;
      const base = unitPrice * item.quantity;
      const taxable = base - discount;
      if (taxable < 0) throw new BadRequestException("Remise superieure au montant de la ligne");
      const lineTax = taxable * taxRate;
      const total = taxable + lineTax;
      subtotal += base;
      itemDiscount += discount;
      tax += lineTax;
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unitPrice,
        quantity: item.quantity,
        discount,
        tax: this.round(lineTax),
        total: this.round(total),
        availableStock,
        primaryBarcode: product.barcodes.find((barcode) => barcode.isPrimary)?.value ?? product.barcodes[0]?.value ?? null,
        hasEnoughStock: availableStock >= item.quantity,
        isCustom: false
      };
    });

    const orderDiscount = dto.discount ?? 0;
    const total = this.round(subtotal - itemDiscount - orderDiscount + tax);
    if (total < 0) throw new BadRequestException("Remise superieure au total du panier");

    return {
      items,
      subtotal: this.round(subtotal),
      itemDiscount: this.round(itemDiscount),
      discount: this.round(orderDiscount),
      tax: this.round(tax),
      total,
      taxRate,
      canCheckout: items.length > 0 && items.every((item) => item.hasEnoughStock)
    };
  }


  async listHeldSales(tenantId: string) {
    const items = await this.prisma.heldSale.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        cart: item.cart,
        customerId: item.customerId,
        payments: item.payments ?? [],
        orderDiscount: Number(item.orderDiscount ?? 0),
        taxRate: Number(item.taxRate ?? 0),
        storeId: item.storeId,
        warehouseId: item.warehouseId,
        cashSessionId: item.cashSessionId,
        total: Number(item.total ?? 0),
        updatedAt: item.updatedAt,
        createdAt: item.createdAt
      }))
    };
  }

  async saveHeldSale(tenantId: string, userId: string | undefined, dto: {
    id?: string;
    cart: Prisma.InputJsonValue;
    customerId?: string | null;
    payments?: Prisma.InputJsonValue;
    orderDiscount?: number;
    taxRate?: number;
    storeId?: string | null;
    warehouseId?: string | null;
    cashSessionId?: string | null;
    total?: number;
    note?: string | null;
  }) {
    if (!dto.cart || typeof dto.cart !== "object") throw new BadRequestException("Panier en attente invalide");
    const total = Number(dto.total ?? (dto.cart as { total?: unknown }).total ?? 0);
    const data = {
      tenantId,
      userId,
      customerId: dto.customerId || null,
      storeId: dto.storeId || null,
      warehouseId: dto.warehouseId || null,
      cashSessionId: dto.cashSessionId || null,
      cart: dto.cart,
      payments: dto.payments ?? [],
      orderDiscount: dto.orderDiscount ?? 0,
      taxRate: dto.taxRate ?? 0,
      total: Number.isFinite(total) ? total : 0,
      note: dto.note || null
    };
    if (dto.id) {
      const existing = await this.prisma.heldSale.findFirst({ where: { id: dto.id, tenantId } });
      if (existing) return this.prisma.heldSale.update({ where: { id: existing.id }, data });
    }
    return this.prisma.heldSale.create({ data });
  }

  async deleteHeldSale(tenantId: string, id: string) {
    const existing = await this.prisma.heldSale.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Vente en attente introuvable");
    await this.prisma.heldSale.delete({ where: { id: existing.id } });
    return { success: true };
  }

  async createQuoteFromCart(tenantId: string, dto: CreateSaleDto, userId?: string) {
    return this.createCommercialDocument(tenantId, dto, userId, "DEVIS POS");
  }

  async createOrderFromCart(tenantId: string, dto: CreateSaleDto, userId?: string) {
    return this.createCommercialDocument(tenantId, dto, userId, "COMMANDE POS");
  }

  async createCustomer(tenantId: string, dto: CreateCustomerDto) {
    const displayName = dto.displayName?.trim() || [dto.firstName, dto.lastName].filter(Boolean).join(" ").trim() || dto.company?.trim();
    if (!displayName || displayName.length < 2) throw new BadRequestException("Le nom du client est obligatoire");

    return this.prisma.customer.create({
      data: {
        tenantId,
        customerCode: dto.customerCode ?? this.customerCode(),
        displayName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        company: dto.company,
        phone: dto.phone,
        mobile: dto.mobile,
        whatsapp: dto.whatsapp,
        email: dto.email,
        address: dto.address,
        notes: dto.notes,
        customerType: dto.customerType ?? "INDIVIDUAL",
        status: dto.status ?? "ACTIVE",
        creditLimit: dto.creditLimit ?? 0,
        currentBalance: dto.currentBalance ?? 0
      },
      select: { id: true, displayName: true, phone: true, mobile: true, whatsapp: true }
    });
  }

  private async createCommercialDocument(tenantId: string, dto: CreateSaleDto, userId: string | undefined, label: string) {
    if (!dto.items?.length) throw new BadRequestException("Panier vide");
    const cart = await this.calculateCart(tenantId, {
      warehouseId: dto.warehouseId,
      taxRate: dto.taxRate ?? 0,
      discount: dto.discount ?? 0,
      items: dto.items
    });
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
      if (!customer) throw new NotFoundException("Client introuvable");
    }
    const quote = await this.prisma.quote.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        documentNumber: this.documentNumber(label === "DEVIS POS" ? "QUO" : "ORD"),
        status: SalesDocumentStatus.DRAFT,
        subtotal: cart.subtotal,
        discount: cart.itemDiscount + cart.discount,
        tax: cart.tax,
        total: cart.total,
        paidAmount: 0,
        balance: cart.total,
        notes: [label, dto.note].filter(Boolean).join(" - "),
        createdById: userId,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId ?? undefined,
            customName: item.customName,
            customType: item.customType,
            customNote: item.customNote,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            tax: item.tax,
            total: item.total
          }))
        }
      },
      include: { items: { include: { product: true } }, customer: true }
    });
    return { ...quote, documentType: label };
  }

  private productForPos(product: Prisma.ProductGetPayload<{ select: {
    id: true;
    sku: true;
    name: true;
    salePrice: true;
    purchasePrice: true;
    barcodes: { select: { value: true; isPrimary: true } };
    images: { select: { url: true } };
    stocks: { select: { warehouseId: true; quantity: true; reserved: true } };
    category: { select: { name: true } };
    brand: { select: { name: true } };
    unit: { select: { name: true; symbol: true } };
  } }>, warehouseId?: string) {
    const scopedAvailable = this.availableStock(product.stocks, warehouseId);
    const totalAvailable = this.availableStock(product.stocks);
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      salePrice: Number(product.salePrice),
      purchasePrice: Number(product.purchasePrice),
      image: product.images[0]?.url ?? null,
      category: product.category?.name ?? null,
      brand: product.brand?.name ?? null,
      unit: product.unit?.symbol ?? product.unit?.name ?? null,
      primaryBarcode: product.barcodes.find((barcode) => barcode.isPrimary)?.value ?? product.barcodes[0]?.value ?? null,
      availableStock: warehouseId && scopedAvailable === 0 && totalAvailable > 0 ? totalAvailable : scopedAvailable,
      totalAvailableStock: totalAvailable
    };
  }

  private availableStock(stocks: Array<{ warehouseId: string; quantity: number; reserved: number }>, warehouseId?: string) {
    return stocks
      .filter((stock) => !warehouseId || stock.warehouseId === warehouseId)
      .reduce((sum, stock) => sum + computeAvailableStock(stock), 0);
  }

  private emptyCart(taxRate: number, discount: number) {
    return { items: [], subtotal: 0, itemDiscount: 0, discount, tax: 0, total: 0, taxRate, canCheckout: false };
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private documentNumber(prefix: string) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private customerCode() {
    return `CUST-${Date.now().toString(36).toUpperCase()}`;
  }
}

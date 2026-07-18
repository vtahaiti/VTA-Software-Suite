import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { availableStock as computeAvailableStock } from "../common/stock-business-rules";
import { CreateCustomerDto } from "../customers/dto/create-customer.dto";
import { ProductQueryDto } from "../products/dto/product-query.dto";
import { CreateSaleDto } from "../sales/dto/create-sale.dto";
import { SalesService } from "../sales/sales.service";
import { PosCartAddDto, PosCartDto, PosCartRemoveDto, PosCartUpdateDto } from "./dto/pos-cart.dto";

@Injectable()
export class PosService {
  private readonly heldSaleLockMs = 10 * 60 * 1000;

  constructor(private readonly prisma: PrismaService, private readonly sales: SalesService) {}

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
      include: { barcodes: true, stocks: true, unit: true }
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
        if (!Number.isInteger(item.quantity)) throw new BadRequestException("Quantite decimale autorisee seulement pour les produits avec unite mesurable.");
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
      this.assertQuantityAllowed(item.quantity, product.unit);
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
        unit: product.unit?.symbol ?? product.unit?.name ?? null,
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


  async listHeldSales(tenantId: string, userId: string, sessionId: string, canViewAll = false) {
    const items = await this.prisma.heldSale.findMany({
      where: { tenantId, status: { in: ["AVAILABLE", "CLAIMED", "FINALIZING"] }, ...(canViewAll ? {} : { userId }) },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    return { items: items.map((item) => this.heldSaleForApi(item, userId, sessionId)) };
  }

  async saveHeldSale(tenantId: string, userId: string | undefined, sessionId: string | undefined, dto: {
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
      if (existing) {
        if (["FINALIZING", "COMPLETED", "CANCELLED"].includes(existing.status)) {
          throw new ConflictException("Cette vente en attente ne peut plus etre modifiee.");
        }
        if (this.isActiveLockOwnedByAnotherSession(existing, sessionId)) {
          throw new ConflictException("Cette vente est deja reprise par un autre caissier.");
        }
        return this.prisma.heldSale.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } });
      }
    }
    return this.prisma.heldSale.create({ data: { ...data, status: "AVAILABLE" } });
  }

  async claimHeldSale(tenantId: string, userId: string, sessionId: string, id: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.heldSaleLockMs);
    const claimed = await this.prisma.heldSale.updateMany({
      where: {
        id,
        tenantId,
        status: { in: ["AVAILABLE", "CLAIMED"] },
        OR: [
          { status: "AVAILABLE" },
          { claimExpiresAt: { lt: now } },
          { claimedBySessionId: sessionId }
        ]
      },
      data: {
        status: "CLAIMED",
        claimedByUserId: userId,
        claimedBySessionId: sessionId,
        claimedAt: now,
        claimExpiresAt: expiresAt,
        version: { increment: 1 }
      }
    });
    if (!claimed.count) {
      const existing = await this.prisma.heldSale.findFirst({ where: { id, tenantId } });
      if (!existing || existing.status === "CANCELLED") throw new NotFoundException("Vente en attente introuvable");
      if (existing.status === "COMPLETED") throw new ConflictException("Cette vente en attente est deja finalisee.");
      if (existing.status === "FINALIZING") throw new ConflictException("Finalisation en cours.");
      throw new ConflictException("Cette vente est deja reprise par un autre caissier.");
    }
    const item = await this.prisma.heldSale.findFirstOrThrow({ where: { id, tenantId } });
    return this.heldSaleForApi(item, userId, sessionId);
  }

  async releaseHeldSale(tenantId: string, userId: string, sessionId: string, id: string, canForce = false) {
    const existing = await this.prisma.heldSale.findFirst({ where: { id, tenantId } });
    if (!existing || existing.status === "CANCELLED") throw new NotFoundException("Vente en attente introuvable");
    if (existing.status === "COMPLETED") return { success: true, status: "COMPLETED" };
    if (existing.status === "FINALIZING") throw new ConflictException("Finalisation en cours.");
    if (this.isActiveLockOwnedByAnotherSession(existing, sessionId) && !canForce) {
      throw new ConflictException("Cette vente est deja reprise par un autre caissier.");
    }
    const item = await this.prisma.heldSale.update({
      where: { id: existing.id },
      data: { status: "AVAILABLE", claimedByUserId: null, claimedBySessionId: null, claimedAt: null, claimExpiresAt: null, version: { increment: 1 } }
    });
    return this.heldSaleForApi(item, userId, sessionId);
  }

  async deleteHeldSale(tenantId: string, userId: string, sessionId: string, id: string, canForce = false) {
    const existing = await this.prisma.heldSale.findFirst({ where: { id, tenantId } });
    if (!existing || existing.status === "CANCELLED") throw new NotFoundException("Vente en attente introuvable");
    if (existing.status === "FINALIZING") throw new ConflictException("Finalisation en cours.");
    if (this.isActiveLockOwnedByAnotherSession(existing, sessionId) && !canForce) {
      throw new ConflictException("Cette vente est deja reprise par un autre caissier.");
    }
    await this.prisma.heldSale.update({
      where: { id: existing.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), claimedByUserId: null, claimedBySessionId: null, claimExpiresAt: null, version: { increment: 1 } }
    });
    return { success: true };
  }

  async finalizeHeldSale(tenantId: string, userId: string, sessionId: string, id: string, dto: CreateSaleDto, idempotencyKey: string) {
    if (!idempotencyKey?.trim()) throw new BadRequestException("Cle d'idempotence obligatoire");
    const existing = await this.prisma.heldSale.findFirst({ where: { id, tenantId } });
    if (!existing || existing.status === "CANCELLED") throw new NotFoundException("Vente en attente introuvable");
    if (existing.status === "COMPLETED" && existing.finalizedSaleId && existing.finalizeIdempotencyKey === idempotencyKey) {
      return this.sales.findOne(tenantId, existing.finalizedSaleId);
    }
    if (this.isActiveLockOwnedByAnotherSession(existing, sessionId)) {
      throw new ConflictException("Cette vente est deja reprise par un autre caissier.");
    }
    const locked = await this.prisma.heldSale.updateMany({
      where: { id, tenantId, status: "CLAIMED", claimedBySessionId: sessionId },
      data: { status: "FINALIZING", finalizeIdempotencyKey: idempotencyKey, version: { increment: 1 } }
    });
    if (!locked.count) {
      const latest = await this.prisma.heldSale.findFirst({ where: { id, tenantId } });
      if (latest?.status === "COMPLETED" && latest.finalizedSaleId && latest.finalizeIdempotencyKey === idempotencyKey) return this.sales.findOne(tenantId, latest.finalizedSaleId);
      if (latest?.status === "FINALIZING") throw new ConflictException("Finalisation en cours.");
      throw new ConflictException("Reprenez la vente en attente avant de l'encaisser.");
    }
    try {
      const sale = await this.sales.create(tenantId, dto, existing.userId ?? userId);
      await this.prisma.heldSale.update({
        where: { id },
        data: {
          status: "COMPLETED",
          finalizedSaleId: sale.id,
          finalizedAt: new Date(),
          claimedByUserId: null,
          claimedBySessionId: null,
          claimExpiresAt: null,
          version: { increment: 1 }
        }
      });
      return sale;
    } catch (error) {
      await this.prisma.heldSale.updateMany({
        where: { id, tenantId, status: "FINALIZING", finalizeIdempotencyKey: idempotencyKey },
        data: { status: "CLAIMED", claimExpiresAt: new Date(Date.now() + this.heldSaleLockMs), version: { increment: 1 } }
      }).catch(() => null);
      throw error;
    }
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


  private heldSaleForApi(item: Prisma.HeldSaleGetPayload<Record<string, never>>, userId: string, sessionId: string) {
    const now = new Date();
    const isExpired = item.status === "CLAIMED" && Boolean(item.claimExpiresAt && item.claimExpiresAt <= now);
    const isClaimedByCurrentSession = item.claimedBySessionId === sessionId;
    return {
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
      status: isExpired ? "AVAILABLE" : item.status,
      lockState: item.status === "FINALIZING" ? "FINALIZING" : isExpired ? "EXPIRED" : isClaimedByCurrentSession ? "CLAIMED_BY_YOU" : item.status === "CLAIMED" ? "CLAIMED_BY_OTHER" : "AVAILABLE",
      claimedByUserId: item.claimedByUserId,
      claimedAt: item.claimedAt,
      claimExpiresAt: item.claimExpiresAt,
      canClaim: item.status === "AVAILABLE" || isExpired || isClaimedByCurrentSession,
      canCancel: item.status !== "FINALIZING" && (item.status !== "CLAIMED" || isExpired || isClaimedByCurrentSession),
      version: item.version,
      updatedAt: item.updatedAt,
      createdAt: item.createdAt
    };
  }

  private isActiveLockOwnedByAnotherSession(item: { status: string; claimedBySessionId?: string | null; claimExpiresAt?: Date | null }, sessionId?: string) {
    return item.status === "CLAIMED" && item.claimedBySessionId && item.claimedBySessionId !== sessionId && Boolean(item.claimExpiresAt && item.claimExpiresAt > new Date());
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

  private assertQuantityAllowed(quantity: number, unit?: { name?: string | null; symbol?: string | null } | null) {
    if (Number.isInteger(quantity)) return;
    const label = `${unit?.symbol ?? ""} ${unit?.name ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tokens = label.split(/[^a-z0-9]+/).filter(Boolean);
    const decimalUnits = ["kg", "kilo", "tonne", "metre", "meter", "m", "pied", "gallon", "litre", "l", "verge"];
    if (decimalUnits.some((entry) => tokens.includes(entry) || (entry.length > 1 && label.includes(entry)))) return;
    throw new BadRequestException("Quantite decimale autorisee seulement pour les unites mesurables.");
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

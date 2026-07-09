import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PurchaseOrderStatus, SupplierInvoiceStatus, SupplierPaymentMethod } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { PurchaseOrderQueryDto } from "./dto/purchase-order-query.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const today = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const [todayAgg, monthAgg, activeSuppliers, pendingOrders, receiptsToday, unpaidInvoices] = await Promise.all([
      this.prisma.purchaseOrder.aggregate({ where: { tenantId, createdAt: { gte: today } }, _sum: { total: true } }),
      this.prisma.purchaseOrder.aggregate({ where: { tenantId, createdAt: { gte: monthStart } }, _sum: { total: true } }),
      this.prisma.supplier.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: { in: ["DRAFT", "SENT", "APPROVED", "PARTIALLY_RECEIVED"] } } }),
      this.prisma.goodsReceipt.count({ where: { tenantId, createdAt: { gte: today } } }),
      this.prisma.supplierInvoice.count({ where: { tenantId, balance: { gt: 0 }, status: { in: ["DRAFT", "APPROVED", "PARTIALLY_PAID"] } } }).catch(() => 0)
    ]);
    return { purchasesToday: todayAgg._sum.total ?? 0, purchasesMonth: monthAgg._sum.total ?? 0, activeSuppliers, pendingOrders, receiptsToday, unpaidInvoices };
  }

  async findAll(tenantId: string, query: PurchaseOrderQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const where: Prisma.PurchaseOrderWhereInput = { tenantId, status: query.status, OR: query.search ? [ { number: { contains: query.search, mode: "insensitive" } }, { supplier: { name: { contains: query.search, mode: "insensitive" } } }, { items: { some: { product: { name: { contains: query.search, mode: "insensitive" } } } } }, { supplierInvoices: { some: { OR: [{ number: { contains: query.search, mode: "insensitive" } }, { invoiceNumber: { contains: query.search, mode: "insensitive" } }] } } } ] : undefined };
    const [items, total] = await this.prisma.$transaction([ this.prisma.purchaseOrder.findMany({ where, include: { supplier: true, items: { include: { product: true } }, receipts: true, supplierInvoices: true }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }), this.prisma.purchaseOrder.count({ where }) ]);
    return { items, meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async findOne(tenantId: string, id: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: { supplier: true, items: { include: { product: true } }, receipts: { include: { warehouse: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" } }, supplierInvoices: { include: { payments: true }, orderBy: { createdAt: "desc" } } } });
    if (!purchaseOrder) throw new NotFoundException("Bon de commande introuvable");
    return purchaseOrder;
  }

  async create(tenantId: string, dto: CreatePurchaseOrderDto) {
    await this.ensureSupplier(tenantId, dto.supplierId); await this.ensureProducts(tenantId, dto.items.map((item) => item.productId));
    const totals = this.calculateTotals(dto.items, dto.discount ?? 0);
    return this.prisma.purchaseOrder.create({ data: { tenantId, supplierId: dto.supplierId, number: this.generateNumber("PO"), storeId: dto.storeId, warehouseId: dto.warehouseId, expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined, notes: dto.notes, discount: totals.discount, subtotal: totals.subtotal, tax: totals.tax, total: totals.total, items: { create: dto.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost, discount: item.discount ?? 0, tax: item.tax ?? 0, total: item.quantity * item.unitCost - (item.discount ?? 0) + (item.tax ?? 0) })) } }, include: { supplier: true, items: { include: { product: true } } } });
  }

  async update(tenantId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const purchaseOrder = await this.findOne(tenantId, id); if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) throw new BadRequestException("Seul un bon de commande brouillon peut etre modifie");
    if (dto.supplierId) await this.ensureSupplier(tenantId, dto.supplierId); if (dto.items) await this.ensureProducts(tenantId, dto.items.map((item) => item.productId));
    const totals = dto.items ? this.calculateTotals(dto.items, dto.discount ?? 0) : undefined;
    return this.prisma.purchaseOrder.update({ where: { id }, data: { supplierId: dto.supplierId, storeId: dto.storeId, warehouseId: dto.warehouseId, expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined, notes: dto.notes, discount: totals?.discount, subtotal: totals?.subtotal, tax: totals?.tax, total: totals?.total, items: dto.items ? { deleteMany: {}, create: dto.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost, discount: item.discount ?? 0, tax: item.tax ?? 0, total: item.quantity * item.unitCost - (item.discount ?? 0) + (item.tax ?? 0) })) } : undefined }, include: { supplier: true, items: { include: { product: true } } } });
  }

  async send(tenantId: string, id: string) { await this.findOne(tenantId, id); return this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.SENT } }); }
  async approve(tenantId: string, id: string) { const po = await this.findOne(tenantId, id); if (!([PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT] as PurchaseOrderStatus[]).includes(po.status)) throw new BadRequestException("Ce bon de commande ne peut pas etre approuve"); return this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.APPROVED, approvedAt: new Date() } }); }
  async cancel(tenantId: string, id: string) { const po = await this.findOne(tenantId, id); if (([PurchaseOrderStatus.FULLY_RECEIVED, PurchaseOrderStatus.RECEIVED] as PurchaseOrderStatus[]).includes(po.status)) throw new BadRequestException("Un bon completement recu ne peut pas etre annule"); return this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.CANCELLED, cancelledAt: new Date() } }); }

  async createSupplierInvoice(tenantId: string, dto: { supplierId: string; purchaseOrderId?: string; invoiceNumber?: string; dueDate?: string; notes?: string; subtotal?: number; discount?: number; tax?: number; total?: number }) {
    await this.ensureSupplier(tenantId, dto.supplierId);
    const order = dto.purchaseOrderId ? await this.findOne(tenantId, dto.purchaseOrderId) : null;
    const subtotal = dto.subtotal ?? Number(order?.subtotal ?? 0); const discount = dto.discount ?? Number(order?.discount ?? 0); const tax = dto.tax ?? Number(order?.tax ?? 0); const total = dto.total ?? subtotal - discount + tax;
    return this.prisma.supplierInvoice.create({ data: { tenantId, supplierId: dto.supplierId, purchaseOrderId: dto.purchaseOrderId, number: this.generateNumber("SI"), invoiceNumber: dto.invoiceNumber, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, notes: dto.notes, subtotal, discount, tax, total, balance: total, status: SupplierInvoiceStatus.APPROVED }, include: { supplier: true, purchaseOrder: true, payments: true } });
  }

  async createSupplierPayment(tenantId: string, userId: string, dto: { supplierId: string; supplierInvoiceId?: string; amount: number; method?: SupplierPaymentMethod; notes?: string }) {
    await this.ensureSupplier(tenantId, dto.supplierId);
    const payment = await this.prisma.supplierPayment.create({ data: { tenantId, supplierId: dto.supplierId, supplierInvoiceId: dto.supplierInvoiceId, number: this.generateNumber("SP"), method: dto.method ?? SupplierPaymentMethod.CASH, amount: dto.amount, notes: dto.notes, createdById: userId } });
    if (dto.supplierInvoiceId) {
      const invoice = await this.prisma.supplierInvoice.findFirst({ where: { id: dto.supplierInvoiceId, tenantId } });
      if (invoice) { const paidAmount = Number(invoice.paidAmount) + Number(dto.amount); const balance = Math.max(0, Number(invoice.total) - paidAmount); await this.prisma.supplierInvoice.update({ where: { id: invoice.id }, data: { paidAmount, balance, status: balance <= 0 ? SupplierInvoiceStatus.PAID : SupplierInvoiceStatus.PARTIALLY_PAID } }); }
    }
    return payment;
  }

  supplierInvoices(tenantId: string) { return this.prisma.supplierInvoice.findMany({ where: { tenantId }, include: { supplier: true, purchaseOrder: true, payments: true }, orderBy: { createdAt: "desc" } }); }
  supplierPayments(tenantId: string) { return this.prisma.supplierPayment.findMany({ where: { tenantId }, include: { supplier: true, supplierInvoice: true }, orderBy: { paidAt: "desc" } }); }

  async exportCsv(tenantId: string) { const orders = await this.prisma.purchaseOrder.findMany({ where: { tenantId }, include: { supplier: true }, orderBy: { createdAt: "desc" } }); return [["Numero","Fournisseur","Statut","Sous-total","Remise","Taxe","Total","Date"], ...orders.map((o)=>[o.number,o.supplier.name,o.status,o.subtotal,o.discount,o.tax,o.total,o.createdAt.toISOString()])].map((row)=>row.map((v)=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"); }
  async exportExcel(tenantId: string) { const orders = await this.prisma.purchaseOrder.findMany({ where: { tenantId }, include: { supplier: true }, orderBy: { createdAt: "desc" } }); return `<table><thead><tr><th>Numero</th><th>Fournisseur</th><th>Statut</th><th>Total</th></tr></thead><tbody>${orders.map((o)=>`<tr><td>${o.number}</td><td>${o.supplier.name}</td><td>${o.status}</td><td>${o.total}</td></tr>`).join("")}</tbody></table>`; }
  async exportPdf(tenantId: string) { const dashboard = await this.dashboard(tenantId); return `Rapport achats\nAchats du jour: ${dashboard.purchasesToday}\nAchats du mois: ${dashboard.purchasesMonth}\nCommandes en attente: ${dashboard.pendingOrders}`; }
  async printPurchaseOrder(tenantId: string, id: string) { const order = await this.findOne(tenantId, id); return this.printDocument("BON DE COMMANDE", order.number, order.supplier.name, order.total); }
  async printSupplierInvoice(tenantId: string, id: string) { const invoice = await this.prisma.supplierInvoice.findFirst({ where: { id, tenantId }, include: { supplier: true } }); if (!invoice) throw new NotFoundException("Facture fournisseur introuvable"); return this.printDocument("FACTURE FOURNISSEUR", invoice.number, invoice.supplier.name, invoice.total); }

  private async ensureSupplier(tenantId: string, supplierId: string) { const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, tenantId } }); if (!supplier) throw new NotFoundException("Fournisseur introuvable"); }
  private async ensureProducts(tenantId: string, productIds: string[]) { const uniqueIds = [...new Set(productIds)]; const count = await this.prisma.product.count({ where: { tenantId, id: { in: uniqueIds } } }); if (count !== uniqueIds.length) throw new NotFoundException("Un ou plusieurs produits sont introuvables"); }
  private calculateTotals(items: { quantity: number; unitCost: number; discount?: number; tax?: number }[], orderDiscount = 0) { const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0); const itemDiscount = items.reduce((sum, item) => sum + (item.discount ?? 0), 0); const discount = orderDiscount + itemDiscount; const tax = items.reduce((sum, item) => sum + (item.tax ?? 0), 0); return { subtotal, discount, tax, total: subtotal - discount + tax }; }
  private generateNumber(prefix: string) { return `${prefix}-${Date.now().toString(36).toUpperCase()}`; }
  private printDocument(title: string, number: string, partner: string, total: unknown) { return `${title}\nEntreprise\nDocument: ${number}\nPartenaire: ${partner}\nDate: ${new Date().toLocaleString("fr-HT")}\nUtilisateur: utilisateur connecte\nTotal: ${total}\n\nLogo entreprise et informations magasin prepares.`; }
}

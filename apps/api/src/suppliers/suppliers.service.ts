import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { SupplierQueryDto } from "./dto/supplier-query.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: SupplierQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.SupplierWhereInput = { tenantId, status: query.status, OR: query.search ? [ { code: { contains: query.search, mode: "insensitive" } }, { name: { contains: query.search, mode: "insensitive" } }, { company: { contains: query.search, mode: "insensitive" } }, { phone: { contains: query.search, mode: "insensitive" } }, { whatsapp: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }, { primaryContact: { contains: query.search, mode: "insensitive" } } ] : undefined };
    const [items, total] = await this.prisma.$transaction([ this.prisma.supplier.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }), this.prisma.supplier.count({ where }) ]);
    return { items, meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async dashboard(tenantId: string) {
    const [active, inactive, unpaid, balance] = await Promise.all([
      this.prisma.supplier.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.supplier.count({ where: { tenantId, status: "INACTIVE" } }),
      this.prisma.supplierInvoice.count({ where: { tenantId, status: { in: ["DRAFT", "APPROVED", "PARTIALLY_PAID"] }, balance: { gt: 0 } } }).catch(() => 0),
      this.prisma.supplierInvoice.aggregate({ where: { tenantId }, _sum: { balance: true } }).catch(() => ({ _sum: { balance: 0 } }))
    ]);
    return { active, inactive, unpaidInvoices: unpaid, balance: balance._sum.balance ?? 0 };
  }

  async findOne(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId }, include: { purchaseOrders: { orderBy: { createdAt: "desc" }, take: 10 }, invoices: { orderBy: { createdAt: "desc" }, take: 10 }, payments: { orderBy: { paidAt: "desc" }, take: 10 } } });
    if (!supplier) throw new NotFoundException("Fournisseur introuvable");
    return { ...supplier, purchaseHistoryPrepared: true, purchaseBalancePrepared: true };
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    try { return await this.prisma.supplier.create({ data: { tenantId, code: dto.code ?? this.generateCode(), name: dto.name, company: dto.company, logoUrl: dto.logoUrl, phone: dto.phone, whatsapp: dto.whatsapp, email: dto.email, address: dto.address, city: dto.city, country: dto.country, taxNumber: dto.taxNumber, primaryContact: dto.primaryContact, paymentTerms: dto.paymentTerms, currency: dto.currency ?? "HTG", status: dto.status ?? "ACTIVE", balance: dto.balance ?? 0, notes: dto.notes } }); }
    catch (error) { if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Code fournisseur deja existant"); throw error; }
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) { await this.findOne(tenantId, id); return this.prisma.supplier.update({ where: { id }, data: dto }); }
  async deactivate(tenantId: string, id: string) { await this.findOne(tenantId, id); return this.prisma.supplier.update({ where: { id }, data: { status: "INACTIVE" } }); }

  async exportCsv(tenantId: string) { const suppliers = await this.prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" } }); return [["Code","Nom","Societe","Telephone","WhatsApp","Email","Ville","Pays","Contact","Devise","Statut"], ...suppliers.map((s)=>[s.code,s.name,s.company??"",s.phone??"",s.whatsapp??"",s.email??"",s.city??"",s.country??"",s.primaryContact??"",s.currency,s.status])].map((row)=>row.map((v)=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"); }
  async exportExcel(tenantId: string) { const suppliers = await this.prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" } }); return `<table><thead><tr><th>Code</th><th>Nom</th><th>Societe</th><th>Telephone</th><th>Email</th><th>Statut</th></tr></thead><tbody>${suppliers.map((s)=>`<tr><td>${s.code}</td><td>${s.name}</td><td>${s.company??""}</td><td>${s.phone??""}</td><td>${s.email??""}</td><td>${s.status}</td></tr>`).join("")}</tbody></table>`; }
  async exportPdf(tenantId: string) { const suppliers = await this.prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }); return `Rapport fournisseurs VTA Commerce\n\n${suppliers.map((s)=>`${s.code} - ${s.name} - ${s.phone??""}`).join("\n")}`; }
  private generateCode() { return `SUP-${Date.now().toString(36).toUpperCase()}`; }
}



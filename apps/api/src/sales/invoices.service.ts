import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalesDocumentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvoicePaymentDto, CreateSalesDocumentDto, SalesDocumentQueryDto, UpdateSalesDocumentDto } from "./dto/sales-document.dto";
import { calculateDocumentTotals, ensureCustomer, ensureProducts, generateDocumentNumber, mapDocumentItems, withDocumentNumber, withDocumentNumbers } from "./sales-documents.util";

@Injectable()
export class InvoicesService { constructor(private readonly prisma: PrismaService) {}
  async findAll(tenantId:string,query:SalesDocumentQueryDto){const page=query.page??1;const limit=query.limit??20;const where:Prisma.InvoiceWhereInput={tenantId,status:query.status as SalesDocumentStatus,OR:query.search?[{documentNumber:{contains:query.search,mode:"insensitive"}},{customer:{displayName:{contains:query.search,mode:"insensitive"}}}]:undefined};const[items,total]=await this.prisma.$transaction([this.prisma.invoice.findMany({where,include:{customer:true,proforma:true,items:{include:{product:true}},payments:true},skip:(page-1)*limit,take:limit,orderBy:{createdAt:"desc"}}),this.prisma.invoice.count({where})]);return{items:withDocumentNumbers(items),meta:{page,limit,total,pageCount:Math.ceil(total/limit)}};}
  async findOne(tenantId:string,id:string){const invoice=await this.prisma.invoice.findFirst({where:{id,tenantId},include:{customer:true,proforma:true,items:{include:{product:true}},payments:true,returns:true}});if(!invoice)throw new NotFoundException("Facture introuvable");return withDocumentNumber({...invoice,customerHistoryPrepared:true,stockUpdatePrepared:true,printFormats:["POS_58_80","A4_LETTER"]});}
  async create(tenantId:string,dto:CreateSalesDocumentDto,createdById?:string){await ensureCustomer(this.prisma,tenantId,dto.customerId);await ensureProducts(this.prisma,tenantId,dto.items.map(i=>i.productId).filter((productId): productId is string => Boolean(productId)));const totals=calculateDocumentTotals(dto.items,dto.discount??0);return withDocumentNumber(await this.prisma.invoice.create({data:{tenantId,customerId:dto.customerId,documentNumber:generateDocumentNumber("INV"),status:SalesDocumentStatus.SENT,notes:dto.notes,createdById,issuedAt:new Date(),...totals,items:{create:mapDocumentItems(dto.items)}},include:{customer:true,items:{include:{product:true}},payments:true}}));}
  async update(tenantId:string,id:string,dto:UpdateSalesDocumentDto){const invoice=await this.findOne(tenantId,id);if(!([SalesDocumentStatus.DRAFT,SalesDocumentStatus.SENT] as SalesDocumentStatus[]).includes(invoice.status))throw new BadRequestException("Cette facture ne peut plus etre modifiee");await ensureCustomer(this.prisma,tenantId,dto.customerId);await ensureProducts(this.prisma,tenantId,dto.items.map(i=>i.productId).filter((productId): productId is string => Boolean(productId)));const totals=calculateDocumentTotals(dto.items,dto.discount??0);return withDocumentNumber(await this.prisma.invoice.update({where:{id},data:{customerId:dto.customerId,notes:dto.notes,...totals,items:{deleteMany:{},create:mapDocumentItems(dto.items)}},include:{customer:true,items:{include:{product:true}},payments:true}}));}
  async registerPayment(tenantId:string,id:string,dto:CreateInvoicePaymentDto){
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, tenantId } });
      if (!invoice) throw new NotFoundException("Facture introuvable");
      if (invoice.status === SalesDocumentStatus.CANCELLED) throw new BadRequestException("Facture annulée");
      if (Number(invoice.balance) <= 0) throw new BadRequestException("Facture déjà payée");
      if (dto.amount > Number(invoice.balance)) throw new BadRequestException("Paiement supérieur au solde");
      // Decrement atomique gardee par balance >= montant dans le meme UPDATE : empeche deux
      // paiements concurrents sur la meme facture de la faire passer sous zero (l'ancien code
      // lisait balance/paidAmount, calculait en JS, puis ecrivait en dehors de toute transaction -
      // un paiement pouvait aussi etre enregistre sans que le solde de la facture soit mis a jour
      // en cas d'echec partiel).
      const updateResult = await tx.invoice.updateMany({
        where: { id, tenantId, balance: { gte: dto.amount } },
        data: { paidAmount: { increment: dto.amount }, balance: { decrement: dto.amount } }
      });
      if (updateResult.count === 0) throw new BadRequestException("Paiement supérieur au solde");
      await tx.payment.create({ data: { invoiceId: id, method: dto.method, amount: dto.amount, reference: dto.reference, notes: dto.notes } });
      const refreshed = await tx.invoice.findFirst({ where: { id, tenantId } });
      const status = Number(refreshed!.balance) <= 0 ? SalesDocumentStatus.PAID : SalesDocumentStatus.PARTIALLY_PAID;
      return withDocumentNumber(await tx.invoice.update({ where: { id }, data: { status }, include: { customer: true, items: { include: { product: true } }, payments: true } }));
    });
  }
  async cancel(tenantId:string,id:string){const invoice=await this.findOne(tenantId,id);if(invoice.status===SalesDocumentStatus.PAID)throw new BadRequestException("Une facture payée ne peut pas etre annulée");return withDocumentNumber(await this.prisma.invoice.update({where:{id},data:{status:SalesDocumentStatus.CANCELLED,cancelledAt:new Date()}}));}
}

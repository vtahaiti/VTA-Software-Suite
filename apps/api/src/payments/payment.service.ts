import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
@Injectable()
export class PaymentService{constructor(private readonly prisma:PrismaService){}
 findBySale(tenantId:string, saleId:string){return this.prisma.payment.findMany({where:{saleId,sale:{tenantId}},orderBy:{createdAt:"asc"}})}
}
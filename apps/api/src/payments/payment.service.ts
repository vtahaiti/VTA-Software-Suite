import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
@Injectable()
export class PaymentService{constructor(private readonly prisma:PrismaService){}
 findBySale(saleId:string){return this.prisma.payment.findMany({where:{saleId},orderBy:{createdAt:"asc"}})}
}
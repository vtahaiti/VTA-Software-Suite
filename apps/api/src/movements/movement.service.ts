import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MovementQueryDto } from "./dto/movement-query.dto";
@Injectable()
export class MovementService{constructor(private readonly prisma:PrismaService){}
 async findAll(tenantId:string,query:MovementQueryDto){const page=query.page??1;const limit=query.limit??20;const where:Prisma.InventoryMovementWhereInput={tenantId,productId:query.productId,warehouseId:query.warehouseId,type:query.type as never};const[items,total]=await this.prisma.$transaction([this.prisma.inventoryMovement.findMany({where,include:{product:true,warehouse:true},skip:(page-1)*limit,take:limit,orderBy:{createdAt:"desc"}}),this.prisma.inventoryMovement.count({where})]);return{items,meta:{page,limit,total,pageCount:Math.ceil(total/limit)}}}
}
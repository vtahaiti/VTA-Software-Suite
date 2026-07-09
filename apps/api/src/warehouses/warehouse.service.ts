import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
@Injectable()
export class WarehouseService { constructor(private readonly prisma:PrismaService){}
 findAll(tenantId:string){return this.prisma.warehouse.findMany({where:{tenantId},orderBy:{name:"asc"}})}
 async findOne(tenantId:string,id:string){const item=await this.prisma.warehouse.findFirst({where:{id,tenantId},include:{stocks:{include:{product:true}}}});if(!item)throw new NotFoundException("Entrepot introuvable");return item;}
 async create(tenantId:string,dto:CreateWarehouseDto){try{return await this.prisma.warehouse.create({data:{tenantId,name:dto.name,code:dto.code??this.code(dto.name),address:dto.address,isActive:dto.isActive??true}})}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")throw new ConflictException("Code entrepot deja existant");throw error;}}
 async update(tenantId:string,id:string,dto:UpdateWarehouseDto){await this.findOne(tenantId,id);return this.prisma.warehouse.update({where:{id},data:{name:dto.name,code:dto.code,address:dto.address,isActive:dto.isActive}})}
 async remove(tenantId:string,id:string){await this.findOne(tenantId,id);await this.prisma.warehouse.delete({where:{id}});return{success:true}}
 private code(value:string){return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,24)}
}
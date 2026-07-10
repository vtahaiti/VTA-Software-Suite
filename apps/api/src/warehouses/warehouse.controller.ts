import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { WarehouseService } from "./warehouse.service";
@UseGuards(JwtAuthGuard)
@Controller("warehouses")
export class WarehouseController{constructor(private readonly service:WarehouseService){}
 @Get() @Permissions("inventory.view") findAll(@Req() req:AuthenticatedRequest){return this.service.findAll(req.user.tenantId)}
 @Get(":id") @Permissions("inventory.view") findOne(@Req() req:AuthenticatedRequest,@Param("id") id:string){return this.service.findOne(req.user.tenantId,id)}
 @Post() @Permissions("inventory.adjust") create(@Req() req:AuthenticatedRequest,@Body() dto:CreateWarehouseDto){return this.service.create(req.user.tenantId,dto)}
 @Patch(":id") @Permissions("inventory.adjust") update(@Req() req:AuthenticatedRequest,@Param("id") id:string,@Body() dto:UpdateWarehouseDto){return this.service.update(req.user.tenantId,id,dto)}
 @Delete(":id") @Permissions("inventory.adjust") remove(@Req() req:AuthenticatedRequest,@Param("id") id:string){return this.service.remove(req.user.tenantId,id)}
}
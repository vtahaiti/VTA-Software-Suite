import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { StoresService } from "./stores.service";
@UseGuards(JwtAuthGuard)
@Controller("store-warehouses")
export class StoreWarehousesController { constructor(private readonly stores: StoresService) {}
  @Get() @Permissions("warehouse.read") findAll(@Req() req: AuthenticatedRequest,@Query() query:any){ return this.stores.findWarehouses(req.user.tenantId,query); }
  @Get("stock") @Permissions("warehouse.read") stock(@Req() req: AuthenticatedRequest){ return this.stores.stock(req.user.tenantId); }
  @Post() @Permissions("warehouse.create") create(@Req() req: AuthenticatedRequest,@Body() dto:any){ return this.stores.createWarehouse(req.user.tenantId,dto); }
  @Patch(":id") @Permissions("warehouse.update") update(@Req() req: AuthenticatedRequest,@Param("id") id:string,@Body() dto:any){ return this.stores.updateWarehouse(req.user.tenantId,id,dto); }
}
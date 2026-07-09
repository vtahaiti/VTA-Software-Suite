import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { StoresService } from "./stores.service";
@UseGuards(JwtAuthGuard)
@Controller("stores")
export class StoresController { constructor(private readonly stores: StoresService) {}
  @Get("dashboard") @Permissions("store.read") dashboard(@Req() req: AuthenticatedRequest){ return this.stores.dashboard(req.user.tenantId); }
  @Get() @Permissions("store.read") findAll(@Req() req: AuthenticatedRequest,@Query() query:any){ return this.stores.findStores(req.user.tenantId,query); }
  @Post() @Permissions("store.create") create(@Req() req: AuthenticatedRequest,@Body() dto:any){ return this.stores.createStore(req.user.tenantId,dto); }
  @Patch(":id") @Permissions("store.update") update(@Req() req: AuthenticatedRequest,@Param("id") id:string,@Body() dto:any){ return this.stores.updateStore(req.user.tenantId,id,dto); }
  @Patch(":id/close") @Permissions("store.delete") close(@Req() req: AuthenticatedRequest,@Param("id") id:string){ return this.stores.closeStore(req.user.tenantId,id); }
}
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { StoresService } from "./stores.service";
@UseGuards(JwtAuthGuard)
@Controller("store-transfers")
export class StoreTransfersController { constructor(private readonly stores: StoresService) {}
  @Get() @Permissions("transfer.read") findAll(@Req() req: AuthenticatedRequest){ return this.stores.transfers(req.user.tenantId); }
  @Post() @Permissions("transfer.create") create(@Req() req: AuthenticatedRequest,@Body() dto:any){ return this.stores.createTransfer(req.user.tenantId,req.user.id,dto); }
  @Patch(":id/validate") @Permissions("transfer.validate") validate(@Req() req: AuthenticatedRequest,@Param("id") id:string){ return this.stores.validateTransfer(req.user.tenantId,id,req.user.id); }
}
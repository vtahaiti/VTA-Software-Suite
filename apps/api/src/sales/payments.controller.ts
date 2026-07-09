import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { SalesPaymentsService } from "./payments.service";
@UseGuards(JwtAuthGuard)
@Controller("payments")
export class SalesPaymentsController { constructor(private readonly service: SalesPaymentsService) {}
  @Get() @Permissions("payment.read") findAll(@Req() req: AuthenticatedRequest) { return this.service.findAll(req.user.tenantId); }
  @Get(":id") @Permissions("payment.read") findOne(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }
}
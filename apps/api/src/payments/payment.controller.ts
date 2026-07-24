import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { PaymentService } from "./payment.service";
@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentController{constructor(private readonly service:PaymentService){}
 @Get("sale/:saleId") @Permissions("sales.view") findBySale(@Req() req:AuthenticatedRequest, @Param("saleId") saleId:string){return this.service.findBySale(req.user.tenantId, saleId)}
}
import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { ReceiptService } from "./receipt.service";
@UseGuards(JwtAuthGuard)
@Controller("receipts")
export class ReceiptController{constructor(private readonly service:ReceiptService){}
 @Get("sale/:saleId") @Permissions("sales.view") findBySale(@Req() req:AuthenticatedRequest, @Param("saleId") saleId:string){return this.service.findBySale(req.user.tenantId, saleId)}
 @Post(":id/print") @Permissions("sales.view") print(@Req() req:AuthenticatedRequest, @Param("id") id:string){return this.service.markPrinted(req.user.tenantId, id)}
}
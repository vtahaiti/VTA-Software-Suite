import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { ReceiptService } from "./receipt.service";
@UseGuards(JwtAuthGuard)
@Controller("receipts")
export class ReceiptController{constructor(private readonly service:ReceiptService){}
 @Get("sale/:saleId") @Permissions("sales.view") findBySale(@Param("saleId") saleId:string){return this.service.findBySale(saleId)}
 @Post(":id/print") @Permissions("sales.view") print(@Param("id") id:string){return this.service.markPrinted(id)}
}
import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { PaymentService } from "./payment.service";
@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentController{constructor(private readonly service:PaymentService){}
 @Get("sale/:saleId") @Permissions("sales.view") findBySale(@Param("saleId") saleId:string){return this.service.findBySale(saleId)}
}
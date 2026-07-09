import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { StockAdjustDto, StockOperationDto } from "./dto/stock-operation.dto";
import { StockQueryDto } from "./dto/stock-query.dto";
import { StockService } from "./stock.service";
@UseGuards(JwtAuthGuard)
@Controller("stock")
export class StockController { constructor(private readonly stockService:StockService){}
  @Get() @Permissions("inventory.view") findAll(@Req() req:AuthenticatedRequest,@Query() query:StockQueryDto){return this.stockService.findAll(req.user.tenantId,query)}
  @Get("alerts") @Permissions("inventory.low_stock.view") alerts(@Req() req:AuthenticatedRequest){return this.stockService.alerts(req.user.tenantId)}
  @Post("in") @Permissions("inventory.adjust") stockIn(@Req() req:AuthenticatedRequest,@Body() dto:StockOperationDto){return this.stockService.stockIn(req.user.tenantId,{...dto,userId:req.user.id})}
  @Post("out") @Permissions("inventory.adjust") stockOut(@Req() req:AuthenticatedRequest,@Body() dto:StockOperationDto){return this.stockService.stockOut(req.user.tenantId,{...dto,userId:req.user.id})}
  @Post("adjust") @Permissions("inventory.adjust") adjust(@Req() req:AuthenticatedRequest,@Body() dto:StockAdjustDto){return this.stockService.adjustTo(req.user.tenantId,dto.productId,dto.warehouseId,dto.quantity,dto.reference,dto.note,req.user.id,dto.storeId)}
}

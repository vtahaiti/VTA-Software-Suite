import { Body, Controller, Get, Header, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import { GoodsReceiptsService } from "./goods-receipts.service";

@UseGuards(JwtAuthGuard)
@Controller("goods-receipts")
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Get()
  @Permissions("purchases.view")
  findAll(@Req() request: AuthenticatedRequest) {
    return this.goodsReceiptsService.findAll(request.user.tenantId);
  }

  @Get(":id/print")
  @Header("Content-Type", "text/plain; charset=utf-8")
  @Permissions("purchases.view")
  print(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.goodsReceiptsService.printReceipt(request.user.tenantId, id); }

  @Post()
  @Permissions("purchases.receive")
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateGoodsReceiptDto) {
    return this.goodsReceiptsService.create(request.user.tenantId, dto, request.user.id);
  }
}

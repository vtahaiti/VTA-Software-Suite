import { Body, Controller, Get, Header, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { InvoicePrintService } from "../print/invoice-print.service";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { SaleQueryDto } from "./dto/sale-query.dto";
import { SalesService } from "./sales.service";

@UseGuards(JwtAuthGuard)
@Controller("sales")
export class SalesController {
  constructor(private readonly service: SalesService, private readonly printService: InvoicePrintService) {}

  @Get()
  @Permissions("sales.view")
  findAll(@Req() req: AuthenticatedRequest, @Query() query: SaleQueryDto) { return this.service.findAll(req.user.tenantId, query, req.user); }

  @Get(":id/receipt")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Permissions("sales.view")
  async receipt(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Query("width") width?: "58" | "72" | "80") {
    await this.service.findOne(req.user.tenantId, id, req.user);
    return this.printService.renderReceipt(req.user.tenantId, id, width ?? "80");
  }

  @Get(":id")
  @Permissions("sales.view")
  findOne(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id, req.user); }

  @Post()
  @Permissions("sales.create")
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSaleDto) { return this.service.create(req.user.tenantId, dto, req.user.id); }

  @Post(":id/cancel")
  @Permissions("sales.cancel")
  cancel(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.cancel(req.user.tenantId, id, req.user.id); }

  @Post(":id/return")
  @Permissions("sales.refund")
  returnSale(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: { warehouseId: string }) { return this.service.returnSale(req.user.tenantId, id, body.warehouseId, req.user.id); }
}

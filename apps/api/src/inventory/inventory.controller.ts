import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { InventoryService } from "./inventory.service";

@RequiresFeature("INVENTORY")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get()
  @Permissions("inventory.view")
  dashboardLegacy(@Req() req: AuthenticatedRequest, @Query() query: any) { return this.service.dashboard(req.user.tenantId, query); }

  @Get("dashboard")
  @Permissions("inventory.view")
  dashboard(@Req() req: AuthenticatedRequest, @Query() query: any) { return this.service.dashboard(req.user.tenantId, query); }

  @Get("movements")
  @Permissions("inventory.audit")
  movements(@Req() req: AuthenticatedRequest, @Query() query: any) { return this.service.movements(req.user.tenantId, query); }

  @Get("alerts")
  @Permissions("inventory.low_stock.view")
  alerts(@Req() req: AuthenticatedRequest) { return this.service.alerts(req.user.tenantId); }

  @Post("adjustments/manual")
  @Permissions("inventory.adjust")
  adjustment(@Req() req: AuthenticatedRequest, @Body() dto: any) { return this.service.createAdjustment(req.user.tenantId, dto); }

  @Get("physical-inventories")
  @Permissions("inventory.view")
  physicalInventories(@Req() req: AuthenticatedRequest) { return this.service.physicalInventories(req.user.tenantId); }

  @Post("physical-inventories")
  @Permissions("inventory.adjust")
  createPhysicalInventory(@Req() req: AuthenticatedRequest, @Body() dto: any) { return this.service.createPhysicalInventory(req.user.tenantId, req.user.id, dto); }

  @Post("physical-inventories/:id/validate")
  @Permissions("inventory.adjust")
  validatePhysicalInventory(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: { correct?: boolean }) { return this.service.validatePhysicalInventory(req.user.tenantId, req.user.id, id, body.correct ?? true); }

  @Post("physical-inventories/:id/cancel")
  @Permissions("inventory.adjust")
  cancelPhysicalInventory(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.cancelPhysicalInventory(req.user.tenantId, id); }

  @Get("scan/:code")
  @Permissions("inventory.view")
  scan(@Req() req: AuthenticatedRequest, @Param("code") code: string) { return this.service.scan(req.user.tenantId, code); }

  @Get("transfers")
  @Permissions("inventory.transfer")
  transfers(@Req() req: AuthenticatedRequest) { return this.service.transfers(req.user.tenantId); }

  @Post("transfers")
  @Permissions("inventory.transfer")
  createTransfer(@Req() req: AuthenticatedRequest, @Body() dto: CreateTransferDto) { return this.service.createTransfer(req.user.tenantId, dto); }

  @Post("transfers/:id/receive")
  @Permissions("inventory.transfer")
  receive(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.receiveTransfer(req.user.tenantId, id); }

  @Post("transfers/:id/cancel")
  @Permissions("inventory.transfer")
  cancel(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.cancelTransfer(req.user.tenantId, id); }

  @Get("reports")
  @Permissions("reports.inventory")
  reports(@Req() req: AuthenticatedRequest) { return this.service.reports(req.user.tenantId); }

  @Get("export/csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=inventory.csv")
  @Permissions("export.inventory")
  exportCsv(@Req() req: AuthenticatedRequest) { return this.service.exportCsv(req.user.tenantId); }

  @Get("export/excel")
  @Header("Content-Type", "application/vnd.ms-excel")
  @Header("Content-Disposition", "attachment; filename=inventory.xls")
  @Permissions("export.inventory")
  exportExcel(@Req() req: AuthenticatedRequest) { return this.service.exportExcel(req.user.tenantId); }

  @Get("export/pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", "attachment; filename=inventory.pdf")
  @Permissions("export.inventory")
  exportPdf(@Req() req: AuthenticatedRequest) { return this.service.exportPdf(req.user.tenantId); }
}

import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { PurchaseOrderQueryDto } from "./dto/purchase-order-query.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { PurchaseOrdersService } from "./purchase-orders.service";

@RequiresFeature("PURCHASES")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("purchase-orders")
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get("dashboard") @Permissions("purchases.view") dashboard(@Req() request: AuthenticatedRequest) { return this.purchaseOrdersService.dashboard(request.user.tenantId); }
  @Get("invoices") @Permissions("purchases.view") invoices(@Req() request: AuthenticatedRequest) { return this.purchaseOrdersService.supplierInvoices(request.user.tenantId); }
  @Get("payments") @Permissions("purchases.view") payments(@Req() request: AuthenticatedRequest) { return this.purchaseOrdersService.supplierPayments(request.user.tenantId); }
  @Post("invoices") @Permissions("purchases.create") createInvoice(@Req() request: AuthenticatedRequest, @Body() dto: Parameters<PurchaseOrdersService["createSupplierInvoice"]>[1]) { return this.purchaseOrdersService.createSupplierInvoice(request.user.tenantId, dto); }
  @Post("payments") @Permissions("purchases.create") createPayment(@Req() request: AuthenticatedRequest, @Body() dto: Parameters<PurchaseOrdersService["createSupplierPayment"]>[2]) { return this.purchaseOrdersService.createSupplierPayment(request.user.tenantId, request.user.id, dto); }

  @Get("export/csv") @Header("Content-Type", "text/csv; charset=utf-8") @Header("Content-Disposition", "attachment; filename=purchases.csv") @Permissions("purchases.export") exportCsv(@Req() request: AuthenticatedRequest) { return this.purchaseOrdersService.exportCsv(request.user.tenantId); }
  @Get("export/excel") @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") @Header("Content-Disposition", "attachment; filename=purchases.xlsx") @Permissions("purchases.export") exportExcel(@Req() request: AuthenticatedRequest) { return this.purchaseOrdersService.exportExcel(request.user.tenantId); }
  @Get("export/pdf") @Header("Content-Type", "application/pdf") @Header("Content-Disposition", "attachment; filename=purchases.pdf") @Permissions("purchases.export") exportPdf(@Req() request: AuthenticatedRequest) { return this.purchaseOrdersService.exportPdf(request.user.tenantId); }

  @Get("invoices/:id/print") @Permissions("purchases.view") @Header("Content-Type", "text/plain; charset=utf-8") printInvoice(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.purchaseOrdersService.printSupplierInvoice(request.user.tenantId, id); }
  @Get() @Permissions("purchases.view") findAll(@Req() request: AuthenticatedRequest, @Query() query: PurchaseOrderQueryDto) { return this.purchaseOrdersService.findAll(request.user.tenantId, query); }
  @Get(":id") @Permissions("purchases.view") findOne(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.purchaseOrdersService.findOne(request.user.tenantId, id); }
  @Get(":id/print") @Permissions("purchases.view") @Header("Content-Type", "text/plain; charset=utf-8") print(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.purchaseOrdersService.printPurchaseOrder(request.user.tenantId, id); }
 @Post() @Permissions("purchases.create") create(@Req() request: AuthenticatedRequest, @Body() dto: CreatePurchaseOrderDto) { return this.purchaseOrdersService.create(request.user.tenantId, dto); }
  @Patch(":id") @Permissions("purchases.update") update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdatePurchaseOrderDto) { return this.purchaseOrdersService.update(request.user.tenantId, id, dto); }
  @Post(":id/send") @Permissions("purchases.update") send(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.purchaseOrdersService.send(request.user.tenantId, id); }
  @Post(":id/approve") @Permissions("purchases.approve") approve(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.purchaseOrdersService.approve(request.user.tenantId, id); }
  @Post(":id/cancel") @Permissions("purchases.cancel") cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.purchaseOrdersService.cancel(request.user.tenantId, id); }
}

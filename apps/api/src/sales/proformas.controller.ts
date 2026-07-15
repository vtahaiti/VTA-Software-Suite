import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { CreateInvoicePaymentDto, CreateSalesDocumentDto, SalesDocumentQueryDto, UpdateSalesDocumentDto, UpdateSalesDocumentStatusDto } from "./dto/sales-document.dto";
import { ProformasService } from "./proformas.service";
@RequiresFeature("ORDERS")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("proformas")
export class ProformasController { constructor(private readonly service: ProformasService) {}
  @Get() @Permissions("proforma.read") findAll(@Req() req: AuthenticatedRequest, @Query() query: SalesDocumentQueryDto) { return this.service.findAll(req.user.tenantId, query); }
  @Get("reports/summary") @Permissions("proforma.read") summary(@Req() req: AuthenticatedRequest) { return this.service.summary(req.user.tenantId); }
  @Get(":id") @Permissions("proforma.read") findOne(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }
  @Post() @Permissions("proforma.create") create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSalesDocumentDto) { return this.service.create(req.user.tenantId, dto, req.user.id); }
  @Patch(":id") @Permissions("proforma.update") update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateSalesDocumentDto) { return this.service.update(req.user.tenantId, id, dto); }
  @Patch(":id/status") @Permissions("proforma.update") updateStatus(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateSalesDocumentStatusDto) { return this.service.updateStatus(req.user.tenantId, id, dto.status); }
  @Post(":id/payments") @Permissions("payment.create") registerPayment(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: CreateInvoicePaymentDto) { return this.service.registerPayment(req.user.tenantId, id, dto); }
  @Post(":id/to-invoice") @Permissions("proforma.convert") convertToInvoice(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.convertToInvoice(req.user.tenantId, id, req.user.id); }
  @Get(":id/print") @Permissions("proforma.read") print(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }
}

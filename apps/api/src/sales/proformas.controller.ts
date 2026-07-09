import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateSalesDocumentDto, SalesDocumentQueryDto, UpdateSalesDocumentDto } from "./dto/sales-document.dto";
import { ProformasService } from "./proformas.service";
@UseGuards(JwtAuthGuard)
@Controller("proformas")
export class ProformasController { constructor(private readonly service: ProformasService) {}
  @Get() @Permissions("proforma.read") findAll(@Req() req: AuthenticatedRequest, @Query() query: SalesDocumentQueryDto) { return this.service.findAll(req.user.tenantId, query); }
  @Get(":id") @Permissions("proforma.read") findOne(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }
  @Post() @Permissions("proforma.create") create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSalesDocumentDto) { return this.service.create(req.user.tenantId, dto, req.user.id); }
  @Patch(":id") @Permissions("proforma.update") update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateSalesDocumentDto) { return this.service.update(req.user.tenantId, id, dto); }
  @Post(":id/to-invoice") @Permissions("proforma.convert") convertToInvoice(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.convertToInvoice(req.user.tenantId, id, req.user.id); }
  @Get(":id/print") @Permissions("proforma.read") print(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }
}
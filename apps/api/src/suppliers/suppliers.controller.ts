import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { SupplierQueryDto } from "./dto/supplier-query.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@RequiresFeature("SUPPLIERS")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get("dashboard")
  @Permissions("suppliers.view")
  dashboard(@Req() request: AuthenticatedRequest) { return this.suppliersService.dashboard(request.user.tenantId); }

  @Get("export/csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=suppliers.csv")
  @Permissions("suppliers.export")
  exportCsv(@Req() request: AuthenticatedRequest) { return this.suppliersService.exportCsv(request.user.tenantId); }

  @Get("export/excel")
  @Header("Content-Type", "application/vnd.ms-excel")
  @Header("Content-Disposition", "attachment; filename=suppliers.xls")
  @Permissions("suppliers.export")
  exportExcel(@Req() request: AuthenticatedRequest) { return this.suppliersService.exportExcel(request.user.tenantId); }

  @Get("export/pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", "attachment; filename=suppliers.pdf")
  @Permissions("suppliers.export")
  exportPdf(@Req() request: AuthenticatedRequest) { return this.suppliersService.exportPdf(request.user.tenantId); }

  @Get()
  @Permissions("suppliers.view")
  findAll(@Req() request: AuthenticatedRequest, @Query() query: SupplierQueryDto) {
    return this.suppliersService.findAll(request.user.tenantId, query);
  }

  @Get(":id")
  @Permissions("suppliers.view")
  findOne(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.suppliersService.findOne(request.user.tenantId, id);
  }

  @Post()
  @Permissions("suppliers.create")
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(request.user.tenantId, dto);
  }

  @Patch(":id")
  @Permissions("suppliers.update")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(request.user.tenantId, id, dto);
  }

  @Post(":id/deactivate")
  @Permissions("suppliers.delete")
  deactivate(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.suppliersService.deactivate(request.user.tenantId, id);
  }
}

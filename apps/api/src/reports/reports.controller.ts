import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

@RequiresFeature("BASIC_REPORTS")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("sales")
  @Permissions("reports.sales")
  sales(@Req() request: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.sales(request.user.tenantId, query);
  }

  @Get("products")
  @Permissions("reports.products")
  products(@Req() request: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.products(request.user.tenantId, query);
  }

  @Get("inventory")
  @Permissions("reports.inventory")
  inventory(@Req() request: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.inventory(request.user.tenantId, query);
  }

  @Get("customers")
  @Permissions("reports.customers")
  customers(@Req() request: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.customers(request.user.tenantId, query);
  }

  @Get("purchases")
  @Permissions("reports.purchases")
  purchases(@Req() request: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.purchases(request.user.tenantId, query);
  }

  @Get("profit")
  @RequiresFeature("ADVANCED_REPORTS")
  @Permissions("reports.profit")
  profit(@Req() request: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.profit(request.user.tenantId, query);
  }

  @Get("dashboard")
  @Permissions("reports.read")
  dashboard(@Req() request: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.dashboard(request.user.tenantId, query);
  }
}

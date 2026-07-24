import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { CustomerStatementQueryDto } from "./dto/customer-statement-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomersService } from "./customers.service";

@RequiresFeature("CUSTOMERS")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions("customer.read")
  findAll(@Req() request: AuthenticatedRequest, @Query() query: CustomerQueryDto) {
    return this.customersService.findAll(request.user.tenantId, query);
  }

  @Get("export")
  @Permissions("customer.export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async export(@Req() request: AuthenticatedRequest, @Query() query: CustomerQueryDto, @Res() response: Response) {
    const csv = await this.customersService.exportCsv(request.user.tenantId, query);
    response.setHeader("Content-Disposition", "attachment; filename=customers.csv");
    response.send(csv);
  }

  @Post("import")
  @Permissions("customer.import")
  import(@Req() request: AuthenticatedRequest, @Body("content") content: string) {
    return this.customersService.importCsv(request.user.tenantId, content);
  }

  @Get(":id")
  @Permissions("customer.read")
  findOne(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.customersService.findOne(request.user.tenantId, id);
  }

  @Get(":id/statement")
  @Permissions("customer.read")
  statement(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Query() query: CustomerStatementQueryDto) {
    return this.customersService.statement(request.user.tenantId, id, query);
  }

  @Post()
  @Permissions("customer.create")
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(request.user.tenantId, dto);
  }

  @Patch(":id")
  @Permissions("customer.update")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(request.user.tenantId, id, dto);
  }

  @Delete(":id")
  @Permissions("customer.delete")
  delete(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.customersService.delete(request.user.tenantId, id);
  }

  @Post(":id/archive")
  @Permissions("customer.delete")
  archive(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.customersService.archive(request.user.tenantId, id);
  }

  @Post(":id/block")
  @Permissions("customer.update")
  block(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.customersService.block(request.user.tenantId, id);
  }

  @Post(":id/reactivate")
  @Permissions("customer.update")
  reactivate(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.customersService.reactivate(request.user.tenantId, id);
  }
}

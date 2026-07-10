import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateSalesDocumentDto, SalesDocumentQueryDto, UpdateSalesDocumentDto } from "./dto/sales-document.dto";
import { QuotesService } from "./quotes.service";
@UseGuards(JwtAuthGuard)
@Controller("quotes")
export class QuotesController { constructor(private readonly service: QuotesService) {}
  @Get() @Permissions("quote.read") findAll(@Req() req: AuthenticatedRequest, @Query() query: SalesDocumentQueryDto) { return this.service.findAll(req.user.tenantId, query); }
  @Get(":id") @Permissions("quote.read") findOne(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }
  @Post() @Permissions("quote.create") create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSalesDocumentDto) { return this.service.create(req.user.tenantId, dto, req.user.id); }
  @Patch(":id") @Permissions("quote.update") update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateSalesDocumentDto) { return this.service.update(req.user.tenantId, id, dto); }
  @Post(":id/send") @Permissions("quote.update") send(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.send(req.user.tenantId, id); }
  @Post(":id/accept") @Permissions("quote.update") accept(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.accept(req.user.tenantId, id); }
  @Post(":id/reject") @Permissions("quote.update") reject(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.reject(req.user.tenantId, id); }
  @Post(":id/to-proforma") @Permissions("quote.convert") convertToProforma(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.convertToProforma(req.user.tenantId, id, req.user.id); }
  @Get(":id/print") @Permissions("quote.read") print(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }
}
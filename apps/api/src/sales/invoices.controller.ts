import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { InvoicePrintService } from "../print/invoice-print.service";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateInvoicePaymentDto, CreateSalesDocumentDto, SalesDocumentQueryDto, UpdateSalesDocumentDto } from "./dto/sales-document.dto";
import { InvoicesService } from "./invoices.service";

@UseGuards(JwtAuthGuard)
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly service: InvoicesService, private readonly printService: InvoicePrintService) {}

  @Get()
  @Permissions("invoice.read")
  findAll(@Req() req: AuthenticatedRequest, @Query() query: SalesDocumentQueryDto) { return this.service.findAll(req.user.tenantId, query); }

  @Get(":id/print")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Permissions("invoice.print")
  print(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Query("format") format?: "a4" | "letter") { return this.printService.renderInvoice(req.user.tenantId, id, format ?? "letter"); }

  @Get(":id/pdf")
  @Permissions("invoice.print")
  async pdf(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    const file = await this.printService.invoicePdf(req.user.tenantId, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename=invoice-${id}.pdf`);
    return new StreamableFile(file);
  }

  @Get(":id")
  @Permissions("invoice.read")
  findOne(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }

  @Post()
  @Permissions("invoice.create")
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSalesDocumentDto) { return this.service.create(req.user.tenantId, dto, req.user.id); }

  @Patch(":id")
  @Permissions("invoice.update")
  update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateSalesDocumentDto) { return this.service.update(req.user.tenantId, id, dto); }

  @Post(":id/payments")
  @Permissions("payment.create")
  registerPayment(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: CreateInvoicePaymentDto) { return this.service.registerPayment(req.user.tenantId, id, dto); }

  @Post(":id/cancel")
  @Permissions("invoice.cancel")
  cancel(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.cancel(req.user.tenantId, id); }
}
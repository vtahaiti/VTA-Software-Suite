import { Body, Controller, Get, Param, Post, Res, Req, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { ImportFileDto } from "./dto/import-file.dto";
import { ExportService } from "./export.service";
import { ImportService } from "./import.service";

@UseGuards(JwtAuthGuard)
@Controller("import-export")
export class ImportExportController {
  constructor(private readonly importer: ImportService, private readonly exporter: ExportService) {}

  @Post("products/import")
  @Permissions("import.products")
  importProducts(@Req() request: AuthenticatedRequest, @Body() dto: ImportFileDto) {
    return this.importer.importProducts(request.user.tenantId, dto.content);
  }

  @Post("customers/import")
  @Permissions("import.customers")
  importCustomers(@Req() request: AuthenticatedRequest, @Body() dto: ImportFileDto) {
    return this.importer.importCustomers(request.user.tenantId, dto.content);
  }

  @Post("suppliers/import")
  @Permissions("import.suppliers")
  importSuppliers(@Req() request: AuthenticatedRequest, @Body() dto: ImportFileDto) {
    return this.importer.importSuppliers(request.user.tenantId, dto.content);
  }

  @Get("products/export/:format")
  @Permissions("export.products")
  async exportProducts(@Req() request: AuthenticatedRequest, @Param("format") format: "csv" | "excel", @Res() response: Response) {
    return this.send(response, await this.exporter.products(request.user.tenantId, this.resolveFormat(format)));
  }

  @Get("customers/export/:format")
  @Permissions("export.customers")
  async exportCustomers(@Req() request: AuthenticatedRequest, @Param("format") format: "csv" | "excel", @Res() response: Response) {
    return this.send(response, await this.exporter.customers(request.user.tenantId, this.resolveFormat(format)));
  }

  @Get("suppliers/export/:format")
  @Permissions("export.suppliers")
  async exportSuppliers(@Req() request: AuthenticatedRequest, @Param("format") format: "csv" | "excel", @Res() response: Response) {
    return this.send(response, await this.exporter.suppliers(request.user.tenantId, this.resolveFormat(format)));
  }

  @Get("inventory/stock/export/:format")
  @Permissions("export.inventory")
  async exportStock(@Req() request: AuthenticatedRequest, @Param("format") format: "csv" | "excel", @Res() response: Response) {
    return this.send(response, await this.exporter.stock(request.user.tenantId, this.resolveFormat(format)));
  }

  @Get("inventory/movements/export/:format")
  @Permissions("export.inventory")
  async exportMovements(@Req() request: AuthenticatedRequest, @Param("format") format: "csv" | "excel", @Res() response: Response) {
    return this.send(response, await this.exporter.movements(request.user.tenantId, this.resolveFormat(format)));
  }

  @Get("inventory/low-stock/export/:format")
  @Permissions("export.inventory")
  async exportLowStock(@Req() request: AuthenticatedRequest, @Param("format") format: "csv" | "excel", @Res() response: Response) {
    return this.send(response, await this.exporter.lowStock(request.user.tenantId, this.resolveFormat(format)));
  }

  private resolveFormat(format: string) { return format === "excel" ? "excel" : "csv"; }
  private send(response: Response, file: { content: string; contentType: string; fileName: string }) {
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    return response.send(file.content);
  }
}
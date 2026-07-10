import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateReferenceDto } from "./dto/create-reference.dto";
import { ImportProductsDto } from "./dto/import-products.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { UpdateReferenceDto } from "./dto/update-reference.dto";
import { ProductsService } from "./products.service";

@UseGuards(JwtAuthGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions("products.view")
  findAll(@Req() request: AuthenticatedRequest, @Query() query: ProductQueryDto) {
    return this.productsService.findAll(request.user.tenantId, query);
  }


  @Get("dashboard")
  @Permissions("products.view")
  dashboard(@Req() request: AuthenticatedRequest) {
    return this.productsService.dashboard(request.user.tenantId);
  }

  @Get("search")
  @Permissions("products.view")
  search(@Req() request: AuthenticatedRequest, @Query("q") q: string, @Query() query: ProductQueryDto) {
    return this.productsService.search(request.user.tenantId, q ?? "", query);
  }

  @Get("barcode/:barcode")
  @Permissions("products.view")
  findByBarcode(@Req() request: AuthenticatedRequest, @Param("barcode") barcode: string) {
    return this.productsService.findByBarcode(request.user.tenantId, barcode);
  }
  @Get("export")
  @Header("Content-Type", "application/vnd.ms-excel")
  @Header("Content-Disposition", "attachment; filename=products.xls")
  @Permissions("products.export")
  exportExcel(@Req() request: AuthenticatedRequest) {
    return this.productsService.exportExcel(request.user.tenantId);
  }

  @Get("export/csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=products.csv")
  @Permissions("products.export")
  exportCsv(@Req() request: AuthenticatedRequest) {
    return this.productsService.exportCsv(request.user.tenantId);
  }

  @Get("export/pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", "attachment; filename=products.pdf")
  @Permissions("products.export")
  exportPdf(@Req() request: AuthenticatedRequest) {
    return this.productsService.exportPdf(request.user.tenantId);
  }

  @Post("import")
  @Permissions("products.import")
  importCsv(@Req() request: AuthenticatedRequest, @Body() dto: ImportProductsDto) {
    return this.productsService.importCsv(request.user.tenantId, dto.csv);
  }

  @Post("import/excel")
  @Permissions("products.import")
  importExcel(@Req() request: AuthenticatedRequest, @Body() dto: ImportProductsDto) {
    return this.productsService.importExcel(request.user.tenantId, dto.csv);
  }

  @Get("categories")
  @Permissions("products.view")
  categories(@Req() request: AuthenticatedRequest, @Query("includeArchived") includeArchived?: string) { return this.productsService.findCategories(request.user.tenantId, includeArchived === "true"); }

  @Post("categories")
  @Permissions("products.create")
  createCategory(@Req() request: AuthenticatedRequest, @Body() dto: CreateReferenceDto) { return this.productsService.createCategory(request.user.tenantId, dto); }

  @Patch("categories/:id")
  @Permissions("products.update")
  updateCategory(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateReferenceDto) { return this.productsService.updateCategory(request.user.tenantId, id, dto); }

  @Patch("categories/:id/archive")
  @Permissions("products.update")
  archiveCategory(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.productsService.archiveCategory(request.user.tenantId, id); }

  @Patch("categories/:id/restore")
  @Permissions("products.update")
  restoreCategory(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.productsService.restoreCategory(request.user.tenantId, id); }

  @Delete("categories/:id")
  @Permissions("products.delete")
  deleteCategory(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.productsService.deleteCategory(request.user.tenantId, id); }

  @Get("brands")
  @Permissions("products.view")
  brands(@Req() request: AuthenticatedRequest) { return this.productsService.findBrands(request.user.tenantId); }

  @Post("brands")
  @Permissions("products.create")
  createBrand(@Req() request: AuthenticatedRequest, @Body() dto: CreateReferenceDto) { return this.productsService.createBrand(request.user.tenantId, dto); }

  @Patch("brands/:id")
  @Permissions("products.update")
  updateBrand(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateReferenceDto) { return this.productsService.updateBrand(request.user.tenantId, id, dto); }

  @Delete("brands/:id")
  @Permissions("products.delete")
  deleteBrand(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.productsService.deleteBrand(request.user.tenantId, id); }

  @Get("units")
  @Permissions("products.view")
  units(@Req() request: AuthenticatedRequest) { return this.productsService.findUnits(request.user.tenantId); }

  @Post("units")
  @Permissions("products.create")
  createUnit(@Req() request: AuthenticatedRequest, @Body() dto: CreateReferenceDto) { return this.productsService.createUnit(request.user.tenantId, dto); }

  @Patch("units/:id")
  @Permissions("products.update")
  updateUnit(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateReferenceDto) { return this.productsService.updateUnit(request.user.tenantId, id, dto); }

  @Delete("units/:id")
  @Permissions("products.delete")
  deleteUnit(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.productsService.deleteUnit(request.user.tenantId, id); }

  @Get(":id/labels")
  @Permissions("products.view")
  labels(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.productsService.labelData(request.user.tenantId, id); }

  @Get(":id")
  @Permissions("products.view")
  findOne(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.productsService.findOne(request.user.tenantId, id); }

  @Post()
  @Permissions("products.create")
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProductDto) { return this.productsService.create(request.user.tenantId, dto); }

  @Patch(":id")
  @Permissions("products.update")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateProductDto) { return this.productsService.update(request.user.tenantId, id, dto); }

  @Delete(":id")
  @Permissions("products.delete")
  remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.productsService.remove(request.user.tenantId, id); }
}

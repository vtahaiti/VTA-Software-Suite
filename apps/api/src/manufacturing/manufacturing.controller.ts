import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { AddManufacturingMaterialDto, CreateManufacturingOrderDto, ManufacturingQueryDto, UpdateManufacturingOrderDto } from "./dto/manufacturing.dto";
import { ManufacturingService } from "./manufacturing.service";

@UseGuards(JwtAuthGuard)
@Controller("manufacturing")
export class ManufacturingController {
  constructor(private readonly service: ManufacturingService) {}

  @Get() @Permissions("manufacturing.view") findAll(@Req() req: AuthenticatedRequest, @Query() query: ManufacturingQueryDto) { return this.service.findAll(req.user.tenantId, query); }
  @Get("summary") @Permissions("manufacturing.view") summary(@Req() req: AuthenticatedRequest) { return this.service.summary(req.user.tenantId); }
  @Get("assignees") @Permissions("manufacturing.view") assignees(@Req() req: AuthenticatedRequest) { return this.service.assignees(req.user.tenantId); }
  @Get("by-proforma/:proformaId") @Permissions("manufacturing.view") byProforma(@Req() req: AuthenticatedRequest, @Param("proformaId") proformaId: string) { return this.service.findByProforma(req.user.tenantId, proformaId); }
  @Get(":id") @Permissions("manufacturing.view") findOne(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.findOne(req.user.tenantId, id); }
  @Post("from-proforma/:proformaId") @Permissions("manufacturing.create") createFromProforma(@Req() req: AuthenticatedRequest, @Param("proformaId") proformaId: string, @Body() dto: CreateManufacturingOrderDto) { return this.service.createFromProforma(req.user.tenantId, proformaId, dto, req.user.id); }
  @Patch(":id") @Permissions("manufacturing.update") update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateManufacturingOrderDto) { return this.service.update(req.user.tenantId, id, dto); }
  @Post(":id/materials") @Permissions("manufacturing.update") addMaterial(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: AddManufacturingMaterialDto) { return this.service.addMaterial(req.user.tenantId, id, dto); }
  @Delete(":id/materials/:materialId") @Permissions("manufacturing.update") removeMaterial(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Param("materialId") materialId: string) { return this.service.removeMaterial(req.user.tenantId, id, materialId); }
  @Post(":id/reserve") @Permissions("manufacturing.manage") reserve(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.reserve(req.user.tenantId, id, req.user.id); }
  @Post(":id/start") @Permissions("manufacturing.manage") start(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.start(req.user.tenantId, id, req.user.id); }
  @Post(":id/ready") @Permissions("manufacturing.update") ready(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.ready(req.user.tenantId, id); }
  @Post(":id/cancel") @Permissions("manufacturing.manage") cancel(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.cancel(req.user.tenantId, id); }
}

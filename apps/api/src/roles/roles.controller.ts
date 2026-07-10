import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesService } from "./roles.service";
@UseGuards(JwtAuthGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}
  @Get() @Permissions("roles.view") findAll(@Req() request: AuthenticatedRequest) { return this.rolesService.findAll(request.user.tenantId); }
  @Post() @Permissions("roles.create") create(@Req() request: AuthenticatedRequest, @Body() dto: CreateRoleDto) { return this.rolesService.create(request.user.tenantId, dto); }
  @Patch(":id") @Permissions("roles.update") update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateRoleDto) { return this.rolesService.update(request.user.tenantId, id, dto); }
  @Delete(":id") @Permissions("roles.delete") remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.rolesService.remove(request.user.tenantId, id); }
}
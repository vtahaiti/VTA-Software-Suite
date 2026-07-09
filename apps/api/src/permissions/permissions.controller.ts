import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { PermissionsService } from "./permissions.service";
@UseGuards(JwtAuthGuard)
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}
  @Get() @Permissions("permissions.view") findAll() { return this.permissionsService.findAll(); }
  @Post() @Permissions("permissions.create") create(@Body() dto: CreatePermissionDto) { return this.permissionsService.create(dto); }
}
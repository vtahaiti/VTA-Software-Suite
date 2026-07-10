import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { AssignUserRoleDto } from "./dto/assign-user-role.dto";
import { UserRolesService } from "./user-roles.service";
@UseGuards(JwtAuthGuard)
@Controller("user-roles")
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}
  @Post() @Permissions("roles.assign") assign(@Req() request: AuthenticatedRequest, @Body() dto: AssignUserRoleDto) { return this.userRolesService.assign(request.user.tenantId, dto); }
}
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UsersService } from "./users.service";

@RequiresFeature("USERS")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions("users.view")
  findAll(@Req() request: AuthenticatedRequest) {
    return this.users.findAll(request.user.tenantId);
  }

  @Post()
  @Permissions("users.create")
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.users.create(request.user.tenantId, dto);
  }

  @Patch(":id/role")
  @Permissions("roles.assign", "users.update")
  updateRole(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateUserRoleDto) {
    return this.users.updateRole(request.user.tenantId, id, dto.role);
  }

  @Patch(":id/disable")
  @Permissions("users.update")
  disable(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.users.disable(request.user.tenantId, id, request.user.id);
  }

  @Patch(":id/reactivate")
  @Permissions("users.update")
  reactivate(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.users.reactivate(request.user.tenantId, id);
  }

  @Patch(":id/password")
  @Permissions("users.update")
  resetPassword(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: ResetUserPasswordDto) {
    return this.users.resetPassword(request.user.tenantId, id, dto.temporaryPassword ?? dto.newPassword ?? dto.password);
  }

  @Get("roles")
  @Permissions("roles.view")
  roles(@Req() request: AuthenticatedRequest) {
    return this.users.roles(request.user.tenantId);
  }
}

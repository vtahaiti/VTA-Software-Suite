import { Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { SecurityService } from "./security.service";

@UseGuards(JwtAuthGuard)
@Controller("security")
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get("logs")
  @Permissions("security.read")
  logs(@Req() request: AuthenticatedRequest, @Query() query: { dateFrom?: string; dateTo?: string; user?: string }) {
    return this.security.findLogs(request.user.tenantId, query);
  }

  @Get("summary")
  @Permissions("security.read")
  summary(@Req() request: AuthenticatedRequest) {
    return this.security.summary(request.user.tenantId);
  }

  @Post("password-change")
  @Permissions("security.read")
  preparePasswordChange(@Req() request: AuthenticatedRequest) {
    return this.security.preparePasswordChange(request.user);
  }
}
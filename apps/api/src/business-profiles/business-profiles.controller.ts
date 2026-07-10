import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { BusinessProfilesService } from "./business-profiles.service";
import { ActivateBusinessProfileDto, ToggleBusinessModuleDto, UpdateBusinessSelectionDto } from "./dto/business-profiles.dto";

@Controller("business-profiles")
export class BusinessProfilesController {
  constructor(private readonly service: BusinessProfilesService) {}

  @Get("catalog")
  catalog() {
    return this.service.catalog();
  }

  @UseGuards(JwtAuthGuard)
  @Get("tenant")
  @Permissions("business.read")
  tenant(@Req() request: AuthenticatedRequest) {
    return this.service.tenantConfiguration(request.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("dashboard")
  @Permissions("dashboard.view")
  dashboard(@Req() request: AuthenticatedRequest) {
    return this.service.dashboard(request.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("tenant/selection")
  @Permissions("business.update")
  updateSelection(@Req() request: AuthenticatedRequest, @Body() dto: UpdateBusinessSelectionDto) {
    return this.service.assignBusinessSelection(request.user.tenantId, dto.businessCategory, dto.primaryActivity, dto.secondaryActivities ?? []);
  }

  @UseGuards(JwtAuthGuard)
  @Post("tenant/profiles")
  @Permissions("business.update")
  activateProfile(@Req() request: AuthenticatedRequest, @Body() dto: ActivateBusinessProfileDto) {
    return this.service.activateProfile(request.user.tenantId, dto.slug, Boolean(dto.isPrimary));
  }

  @UseGuards(JwtAuthGuard)
  @Patch("tenant/profiles/:slug/disable")
  @Permissions("business.update")
  deactivateProfile(@Req() request: AuthenticatedRequest, @Param("slug") slug: string) {
    return this.service.deactivateProfile(request.user.tenantId, slug);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("tenant/modules/:key")
  @Permissions("business.update")
  setModuleState(@Req() request: AuthenticatedRequest, @Param("key") key: string, @Body() dto: ToggleBusinessModuleDto) {
    return this.service.setModuleState(request.user.tenantId, key, dto.isActive);
  }
}
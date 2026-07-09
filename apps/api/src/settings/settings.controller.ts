import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CompanyProfileService } from "./company-profile.service";
import { UpdateCompanyProfileDto, UpdateInvoicingSettingsDto, UpdatePosSettingsDto } from "./dto/settings.dto";
import { TenantSettingsService } from "./tenant-settings.service";

@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly company: CompanyProfileService, private readonly settings: TenantSettingsService) {}

  @Get()
  @Permissions("settings.read")
  async all(@Req() req: AuthenticatedRequest) {
    const [company, settings] = await Promise.all([this.company.find(req.user.tenantId), this.settings.find(req.user.tenantId)]);
    return { company, settings };
  }

  @Get("company")
  @Permissions("settings.company")
  companyProfile(@Req() req: AuthenticatedRequest) { return this.company.find(req.user.tenantId); }

  @Patch("company")
  @Permissions("settings.update", "settings.company")
  updateCompany(@Req() req: AuthenticatedRequest, @Body() dto: UpdateCompanyProfileDto) { return this.company.update(req.user.tenantId, dto); }

  @Get("pos")
  @Permissions("settings.pos")
  pos(@Req() req: AuthenticatedRequest) { return this.settings.find(req.user.tenantId); }

  @Patch("pos")
  @Permissions("settings.update", "settings.pos")
  updatePos(@Req() req: AuthenticatedRequest, @Body() dto: UpdatePosSettingsDto) { return this.settings.updatePos(req.user.tenantId, dto); }

  @Get("invoicing")
  @Permissions("settings.invoicing")
  invoicing(@Req() req: AuthenticatedRequest) { return this.settings.find(req.user.tenantId); }

  @Patch("invoicing")
  @Permissions("settings.update", "settings.invoicing")
  updateInvoicing(@Req() req: AuthenticatedRequest, @Body() dto: UpdateInvoicingSettingsDto) { return this.settings.updateInvoicing(req.user.tenantId, dto); }
}
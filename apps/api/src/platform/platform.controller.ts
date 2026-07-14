import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { CreatePlatformNoteDto } from "./dto/create-platform-note.dto";
import { SendPlatformMessageDto } from "./dto/send-platform-message.dto";
import { ToggleTenantModuleDto } from "./dto/toggle-tenant-module.dto";
import { UpdateTenantStatusDto } from "./dto/update-tenant-status.dto";
import { UpdateTenantSubscriptionDto } from "./dto/update-tenant-subscription.dto";
import { PlatformAdminGuard } from "./guards/platform-admin.guard";
import { PlatformService } from "./platform.service";

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller("platform")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("stats")
  stats() {
    return this.platform.stats();
  }

  @Get("tenants")
  tenants() {
    return this.platform.tenants();
  }

  @Get("tenants/:id")
  tenant(@Param("id") id: string) {
    return this.platform.tenant(id);
  }

  @Patch("tenants/:id/status")
  updateTenantStatus(@Param("id") id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.platform.updateTenantStatus(id, dto.status, dto.reason);
  }

  @Patch("tenants/:id/subscription")
  updateSubscription(@Param("id") id: string, @Body() dto: UpdateTenantSubscriptionDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateSubscription(id, dto, request.user.id);
  }

  @Post("subscription-requests/:requestId/approve")
  approveSubscriptionRequest(@Param("requestId") requestId: string, @Req() request: AuthenticatedRequest) {
    return this.platform.approvePlanChangeRequest(requestId, request.user.id);
  }

  @Post("subscription-requests/:requestId/reject")
  rejectSubscriptionRequest(@Param("requestId") requestId: string, @Body() dto: { reason?: string }, @Req() request: AuthenticatedRequest) {
    return this.platform.rejectPlanChangeRequest(requestId, dto.reason, request.user.id);
  }

  @Patch("tenants/:id/modules/:moduleKey")
  toggleModule(@Param("id") id: string, @Param("moduleKey") moduleKey: string, @Body() dto: ToggleTenantModuleDto) {
    return this.platform.toggleTenantModule(id, moduleKey, dto.isActive, dto.reason);
  }

  @Post("tenants/:id/notes")
  addNote(@Param("id") id: string, @Body() dto: CreatePlatformNoteDto) {
    return this.platform.addNote(id, dto.note);
  }

  @Post("tenants/:id/notifications")
  sendNotification(@Param("id") id: string, @Body() dto: SendPlatformMessageDto) {
    return this.platform.sendTenantNotification(id, dto);
  }

  @Get("notifications")
  notificationHistory() {
    return this.platform.platformNotificationHistory();
  }

  @Post("notifications")
  sendPlatformNotifications(@Body() dto: SendPlatformMessageDto & { tenantId?: string; tenantIds?: string[]; recipient?: "tenant" | "tenants" | "all-active"; ownersOnly?: boolean; role?: string; level?: "info" | "success" | "warning" | "error" | "urgent"; link?: string; expiresAt?: string; dedupKey?: string }, @Req() request: AuthenticatedRequest) {
    return this.platform.sendPlatformNotifications(dto, request.user.id);
  }

  @Post("tenants/:id/email")
  prepareEmail(@Param("id") id: string, @Body() dto: SendPlatformMessageDto) {
    return this.platform.prepareTenantEmail(id, dto);
  }

  @Get("subscriptions")
  subscriptions() {
    return this.platform.subscriptions();
  }

  @Get("plans")
  plans() {
    return this.platform.plans();
  }

  @Get("modules")
  modules() {
    return this.platform.modules();
  }

  @Delete("tenants/demo")
  deleteDemoTenants() {
    return this.platform.deleteDemoTenants();
  }

  @Delete("tenants/:id")
  deleteTenant(@Param("id") id: string, @Body() body: { reason?: string }) {
    return this.platform.deleteTenant(id, body.reason);
  }

  @Get("logs")
  logs() {
    return this.platform.logs();
  }
}

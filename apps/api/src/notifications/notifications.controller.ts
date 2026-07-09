import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { NotificationsService } from "./notifications.service";

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Permissions("notifications.read")
  findForUser(@Req() request: AuthenticatedRequest, @Query() query: { status?: "unread" | "read" | "archived"; type?: "info" | "success" | "warning" | "error"; module?: string }) {
    return this.notifications.findForUser(request.user, query);
  }

  @Get("unread-count")
  @Permissions("notifications.read")
  unreadCount(@Req() request: AuthenticatedRequest) {
    return this.notifications.unreadCount(request.user);
  }

  @Post()
  @Permissions("notifications.update")
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateNotificationDto) {
    return this.notifications.createForUser(request.user.tenantId, request.user.id, dto);
  }

  @Patch("read-all")
  @Permissions("notifications.update")
  markAllAsRead(@Req() request: AuthenticatedRequest) {
    return this.notifications.markAllAsRead(request.user);
  }

  @Patch(":id/read")
  @Permissions("notifications.update")
  markAsRead(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.notifications.markAsRead(request.user, id);
  }

  @Patch(":id/archive")
  @Permissions("notifications.archive")
  archive(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.notifications.archive(request.user, id);
  }
}
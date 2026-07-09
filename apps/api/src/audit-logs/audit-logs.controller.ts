import { Body, Controller, Get, Header, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { AuditLogsService, type AuditQuery } from "./audit-logs.service";

@UseGuards(JwtAuthGuard)
@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @Permissions("audit.read")
  findAll(@Req() request: AuthenticatedRequest, @Query() query: AuditQuery) {
    return this.auditLogs.findAll(request.user.tenantId, query);
  }

  @Post()
  @Permissions("audit.read")
  create(@Req() request: AuthenticatedRequest, @Body() body: { action?: AuditAction; entity?: string; entityId?: string; message?: string }) {
    return this.auditLogs.create({ tenantId: request.user.tenantId, tenantName: request.user.tenant, userId: request.user.id, userEmail: request.user.email, userName: request.user.name, action: body.action ?? AuditAction.CREATE, entity: body.entity ?? "System", entityId: body.entityId, message: body.message ?? "Journal d'audit cree manuellement" });
  }

  @Get("export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=audit-logs.csv")
  @Permissions("audit.export")
  exportCsv(@Req() request: AuthenticatedRequest, @Query() query: AuditQuery) {
    return this.auditLogs.exportCsv(request.user.tenantId, query);
  }

  @Get(":id")
  @Permissions("audit.read")
  findOne(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.auditLogs.findOneForUser(request.user, id);
  }
}

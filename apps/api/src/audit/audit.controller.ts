import { Controller, Get, Header, Param, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { AuditLogsService, type AuditQuery } from "../audit-logs/audit-logs.service";

@UseGuards(JwtAuthGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @Permissions("audit.read")
  findAll(@Req() request: AuthenticatedRequest, @Query() query: AuditQuery) {
    return this.auditLogs.findAllForUser(request.user, query);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=vta-audit.csv")
  @Permissions("audit.export")
  exportCsv(@Req() request: AuthenticatedRequest, @Query() query: AuditQuery) {
    return this.auditLogs.exportCsvForUser(request.user, query);
  }

  @Get("export.xlsx")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", "attachment; filename=vta-audit.xlsx")
  @Permissions("audit.export")
  exportExcelPrepared() {
    return "Export Excel prepare. Le generateur XLSX sera branche dans le service d'export global.";
  }

  @Get("export.pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", "attachment; filename=vta-audit.pdf")
  @Permissions("audit.export")
  exportPdfPrepared() {
    return "Export PDF prepare. Le generateur PDF sera branche dans le service d'impression global.";
  }

  @Get(":id")
  @Permissions("audit.read")
  findOne(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.auditLogs.findOneForUser(request.user, id);
  }
}

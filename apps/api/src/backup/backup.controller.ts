import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { BackupService } from "./backup.service";

@UseGuards(JwtAuthGuard)
@Controller("backups")
export class BackupController {
  constructor(private readonly backups: BackupService) {}

  @Get()
  @Permissions("backup.read")
  findAll(@Req() request: AuthenticatedRequest) {
    return this.backups.findAll(request.user.tenantId);
  }

  @Post("export")
  @Permissions("backup.create")
  exportDatabase(@Req() request: AuthenticatedRequest) {
    return this.backups.createPreparedBackup(request.user);
  }
}
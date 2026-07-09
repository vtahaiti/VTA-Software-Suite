import { Injectable } from "@nestjs/common";
import { AuditAction, BackupStatus } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService, private readonly auditLogs: AuditLogsService) {}

  findAll(tenantId: string) {
    return this.prisma.backupRecord.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async createPreparedBackup(user: AuthUser) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const record = await this.prisma.backupRecord.create({ data: { tenantId: user.tenantId, userId: user.id, userEmail: user.email, status: BackupStatus.SUCCESS, filePath: `prepared/backups/vta-${user.tenantId}-${timestamp}.dump`, fileSize: 0, message: "Sauvegarde PostgreSQL preparee. Execution pg_dump a configurer sur le serveur." } });
    await this.auditLogs.create({ tenantId: user.tenantId, userId: user.id, userEmail: user.email, action: AuditAction.BACKUP, entity: "BackupRecord", entityId: record.id, message: "Sauvegarde preparee" });
    return record;
  }
}
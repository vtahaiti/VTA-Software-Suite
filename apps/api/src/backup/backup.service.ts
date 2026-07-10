import { Injectable } from "@nestjs/common";
import { AuditAction, BackupStatus } from "@prisma/client";
import { execFile } from "child_process";
import { mkdir, stat } from "fs/promises";
import { dirname, join } from "path";
import { promisify } from "util";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService, private readonly auditLogs: AuditLogsService) {}

  findAll(tenantId: string) {
    return this.prisma.backupRecord.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async createPreparedBackup(user: AuthUser) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = join(process.env.DATABASE_BACKUP_DIR ?? "backups", `vta-${user.tenantId}-${timestamp}.dump`);
    const backupResult = await this.createDatabaseDump(filePath);
    const record = await this.prisma.backupRecord.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        status: backupResult.success ? BackupStatus.SUCCESS : BackupStatus.ERROR,
        filePath,
        fileSize: backupResult.fileSize,
        message: backupResult.message
      }
    });
    await this.auditLogs.create({ tenantId: user.tenantId, userId: user.id, userEmail: user.email, action: AuditAction.BACKUP, entity: "BackupRecord", entityId: record.id, message: backupResult.success ? "Sauvegarde creee" : "Sauvegarde en erreur" });
    return record;
  }

  private async createDatabaseDump(filePath: string) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return { success: false, fileSize: 0, message: "DATABASE_URL est manquant. Sauvegarde impossible." };
    }

    try {
      await mkdir(dirname(filePath), { recursive: true });
      await execFileAsync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${filePath}`, databaseUrl], {
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 10
      });
      const info = await stat(filePath);
      return { success: true, fileSize: info.size, message: "Sauvegarde PostgreSQL creee avec succes." };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Erreur inconnue";
      return {
        success: false,
        fileSize: 0,
        message: `pg_dump indisponible ou sauvegarde echouee: ${reason}. Configurez pg_dump dans l'image API ou utilisez une tache Coolify docker exec pg_dump.`
      };
    }
  }
}

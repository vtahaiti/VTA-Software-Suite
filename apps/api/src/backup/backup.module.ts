import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BackupController } from "./backup.controller";
import { BackupService } from "./backup.service";

@Module({ imports: [PrismaModule, AuditLogsModule], controllers: [BackupController], providers: [BackupService], exports: [BackupService] })
export class BackupModule {}
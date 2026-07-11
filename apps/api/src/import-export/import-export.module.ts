import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ExportService } from "./export.service";
import { ImportExportController } from "./import-export.controller";
import { ImportService } from "./import.service";

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [ImportExportController],
  providers: [ImportService, ExportService],
  exports: [ImportService, ExportService]
})
export class ImportExportModule {}
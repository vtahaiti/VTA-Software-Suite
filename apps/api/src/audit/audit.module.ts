import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuditController } from "./audit.controller";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditService } from "./audit.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }]
})
export class AuditModule {}

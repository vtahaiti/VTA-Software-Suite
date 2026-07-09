import { Injectable } from "@nestjs/common";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

@Injectable()
export class AuditService {
  constructor(readonly logs: AuditLogsService) {}
}

import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import type { TenantContextRequest } from "../types/tenant-context-request";

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(request: TenantContextRequest, _response: Response, next: NextFunction) {
    if (request.user?.tenantId) {
      request.tenantId = request.user.tenantId;
      request.tenant = {
        id: request.user.tenantId,
        name: request.user.tenant
      };
    }

    next();
  }
}
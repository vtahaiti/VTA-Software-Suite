import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class RbacContextMiddleware implements NestMiddleware {
  use(request: Request & { user?: { role?: string; roles?: string[]; permissions?: string[] } }, _response: Response, next: NextFunction) {
    if (request.user?.role && !request.user.roles) request.user.roles = [request.user.role];
    if (request.user && !request.user.permissions) request.user.permissions = [];
    next();
  }
}
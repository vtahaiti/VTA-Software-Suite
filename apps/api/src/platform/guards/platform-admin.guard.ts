import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../auth/types/authenticated-request";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roles = request.user?.roles ?? [request.user?.role].filter(Boolean);
    if (!roles.includes("PlatformAdmin")) {
      throw new ForbiddenException("Acces reserve a VTA");
    }
    return true;
  }
}

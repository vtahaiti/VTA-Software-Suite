import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../auth/types/authenticated-request";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roles = request.user?.roles ?? [request.user?.role].filter(Boolean);
    const audience = request.user?.audience ?? request.user?.aud;
    const hasPlatformAudience = audience === "platform" || (Array.isArray(audience) && audience.includes("platform"));
    const hasTrustedIssuer = request.user?.iss === (process.env.JWT_ISSUER ?? "vtaerp.com");
    if (!hasPlatformAudience || !hasTrustedIssuer) {
      throw new ForbiddenException("Session plateforme requise");
    }
    if (!roles.some((role) => role === "SUPER_ADMIN" || role === "PlatformAdmin")) {
      throw new ForbiddenException("Acces reserve a VTA");
    }
    return true;
  }
}

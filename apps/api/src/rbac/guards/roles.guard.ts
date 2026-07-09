import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { role?: string; roles?: string[] } }>();
    const userRoles = request.user?.roles ?? (request.user?.role ? [request.user.role] : []);
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
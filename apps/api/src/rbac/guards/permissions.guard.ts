import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredPermissions?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { permissions?: string[]; role?: string; roles?: string[] } }>();
    const userRoles = new Set([request.user?.role, ...(request.user?.roles ?? [])].filter(Boolean));
    if (["Owner", "OWNER", "Administrator", "ADMIN", "Admin", "PlatformAdmin"].some((role) => userRoles.has(role))) return true;
    if (this.isPointOfSaleAccess(requiredPermissions) && ["Manager", "MANAGER", "Cashier", "CAISSIER", "Sales"].some((role) => userRoles.has(role))) return true;
    const userPermissions = request.user?.permissions ?? [];
    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  }

  private isPointOfSaleAccess(requiredPermissions: string[]) {
    const pointOfSalePermissions = new Set(["pos.sell", "pos.open", "pos.close", "sales.view", "sales.create", "invoice.read", "invoice.print", "payment.create", "customer.read", "customer.create", "products.view"]);
    return requiredPermissions.every((permission) => pointOfSalePermissions.has(permission));
  }
}

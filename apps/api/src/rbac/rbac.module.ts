import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";
import { RbacContextMiddleware } from "./middleware/rbac-context.middleware";

@Module({
  providers: [
    Reflector,
    RbacContextMiddleware,
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard }
  ],
  exports: [RbacContextMiddleware]
})
export class RbacModule {}
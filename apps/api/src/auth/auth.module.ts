import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { SecurityModule } from "../security/security.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthenticationMiddleware } from "./middleware/authentication.middleware";

@Global()
@Module({
  imports: [JwtModule.register({}), PrismaModule, SecurityModule, AuditLogsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AuthenticationMiddleware],
  exports: [AuthService, JwtAuthGuard, AuthenticationMiddleware]
})
export class AuthModule {}
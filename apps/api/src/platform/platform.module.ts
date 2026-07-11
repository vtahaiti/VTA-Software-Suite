import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [AuthModule, PrismaModule, SubscriptionsModule],
  controllers: [PlatformController],
  providers: [PlatformService]
})
export class PlatformModule {}

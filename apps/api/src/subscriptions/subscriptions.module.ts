import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionEntitlementsService } from "./subscription-entitlements.service";
import { SubscriptionFeatureGuard } from "./subscription-feature.guard";
import { SubscriptionsController } from "./subscriptions.controller";

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionEntitlementsService, SubscriptionFeatureGuard],
  exports: [SubscriptionEntitlementsService, SubscriptionFeatureGuard]
})
export class SubscriptionsModule {}

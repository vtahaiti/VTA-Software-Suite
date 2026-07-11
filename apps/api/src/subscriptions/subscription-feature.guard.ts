import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { SUBSCRIPTION_FEATURE_KEY } from "./requires-feature.decorator";
import { SubscriptionEntitlementsService } from "./subscription-entitlements.service";
import type { SubscriptionFeatureKey } from "./subscription-features";

@Injectable()
export class SubscriptionFeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly entitlements: SubscriptionEntitlementsService) {}

  async canActivate(context: ExecutionContext) {
    const featureKey = this.reflector.getAllAndOverride<SubscriptionFeatureKey | undefined>(SUBSCRIPTION_FEATURE_KEY, [context.getHandler(), context.getClass()]);
    if (!featureKey) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (user.roles?.includes("SUPER_ADMIN") || user.roles?.includes("PlatformAdmin")) return true;
    await this.entitlements.assertFeature(user.tenantId, featureKey);
    return true;
  }
}

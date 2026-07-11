import { SetMetadata } from "@nestjs/common";
import type { SubscriptionFeatureKey } from "./subscription-features";

export const SUBSCRIPTION_FEATURE_KEY = "subscription_feature_key";

export function RequiresFeature(featureKey: SubscriptionFeatureKey) {
  return SetMetadata(SUBSCRIPTION_FEATURE_KEY, featureKey);
}

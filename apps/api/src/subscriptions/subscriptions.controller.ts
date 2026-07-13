import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { SubscriptionEntitlementsService } from "./subscription-entitlements.service";

@UseGuards(JwtAuthGuard)
@Controller("subscription")
export class SubscriptionsController {
  constructor(private readonly entitlements: SubscriptionEntitlementsService) {}

  @Get("plans")
  plans() {
    return this.entitlements.listPlans();
  }

  @Get("me")
  me(@Req() req: AuthenticatedRequest) {
    return this.entitlements.getEntitlements(req.user.tenantId);
  }

  @Post("plan-requests")
  requestPlanChange(@Req() req: AuthenticatedRequest, @Body() body: { planCode?: string }) {
    return this.entitlements.requestPlanChange(req.user.tenantId, req.user.id, body.planCode ?? "");
  }
}

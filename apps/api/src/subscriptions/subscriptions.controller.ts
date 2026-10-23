import { ForbiddenException, Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
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
    if (![req.user.role, ...(req.user.roles ?? [])].some(role => ["owner", "propriétaire"].includes(role.toLowerCase()))) {
      throw new ForbiddenException("Seul le propriétaire peut gérer l’abonnement de l’entreprise.");
    }
    return this.entitlements.requestPlanChange(req.user.tenantId, req.user.id, body.planCode ?? "");
  }
}

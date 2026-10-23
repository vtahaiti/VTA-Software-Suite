import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AppleSubscriptionsService } from "./apple-subscriptions.service";

@Controller("subscription/apple")
export class AppleSubscriptionsController {
  constructor(private readonly apple: AppleSubscriptionsService) {}
  @UseGuards(JwtAuthGuard)
  @Get("catalog")
  catalog(@Req() req: AuthenticatedRequest) { return this.apple.catalog(req.user); }
  @UseGuards(JwtAuthGuard)
  @Post("verify")
  verify(@Req() req: AuthenticatedRequest, @Body() body: { signedTransaction?: string }) { return this.apple.verify(req.user, body.signedTransaction ?? ""); }
  // Apple authenticates this public endpoint with a verified signed notification.
  @Post("notifications")
  notification(@Body() body: { signedPayload?: string }) { return this.apple.notification(body.signedPayload ?? ""); }
}

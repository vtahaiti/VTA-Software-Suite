import { Body, Controller, ForbiddenException, Get, Headers, Post, Req, ServiceUnavailableException, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import type { AuthUser } from "../auth/types/auth-user";
import { SendTestEmailDto } from "./dto/send-test-email.dto";
import { EmailService } from "./email.service";

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller("email")
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @UseGuards(JwtAuthGuard)
  @Get("status")
  async status(@Req() request: AuthenticatedRequest) {
    this.assertCanManageEmails(request.user);
    return this.emailService.getStatus(request.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("test")
  async sendTest(@Req() request: AuthenticatedRequest, @Body() dto: SendTestEmailDto) {
    this.assertCanManageEmails(request.user);
    const result = await this.emailService.sendTestEmail({
      tenantId: request.user.tenantId,
      userId: request.user.id,
      to: dto.to ?? request.user.email
    });
    return { provider: result.provider, status: result.status, accepted: result.accepted, messageId: result.messageId };
  }

  @Post("webhooks/resend")
  async resendWebhook(@Req() request: RawBodyRequest, @Headers() headers: Record<string, string | string[] | undefined>, @Body() body: Record<string, unknown>) {
    if (!process.env.RESEND_WEBHOOK_SECRET) {
      throw new ServiceUnavailableException("Webhook Resend non configuré.");
    }
    if (!this.emailService.verifyResendWebhook(headers, request.rawBody)) {
      throw new UnauthorizedException("Signature webhook invalide.");
    }

    const eventType = typeof body.type === "string" ? body.type : "unknown";
    const data = typeof body.data === "object" && body.data ? body.data as Record<string, unknown> : {};
    const messageId = stringValue(data.email_id) ?? stringValue(data.id) ?? stringValue(data.message_id);
    const eventId = stringValue(body.id) ?? stringValue(data.event_id);
    const status = mapResendEvent(eventType);
    return this.emailService.recordWebhookEvent({ provider: "resend", eventId, eventType, messageId, status, metadata: { source: "resend" } });
  }

  private assertCanManageEmails(user: AuthUser) {
    const roles = new Set([user.role, ...(user.roles ?? [])]);
    if (roles.has("OWNER") || roles.has("Owner") || roles.has("ADMIN") || roles.has("Admin") || roles.has("PlatformAdmin") || roles.has("SUPER_ADMIN")) return;
    const permissions = new Set(user.permissions ?? []);
    if (permissions.has("settings.update") || permissions.has("settings.read")) return;
    throw new ForbiddenException("Accès email non autorisé.");
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function mapResendEvent(eventType: string) {
  if (eventType.includes("delivered")) return "delivered" as const;
  if (eventType.includes("bounced")) return "bounced" as const;
  if (eventType.includes("complained")) return "complained" as const;
  if (eventType.includes("failed")) return "failed" as const;
  return "accepted" as const;
}
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { PrismaService } from "../prisma/prisma.service";
import { passwordChangedTemplate, passwordResetTemplate, type EmailTemplate } from "./email.templates";

type EmailProvider = "resend" | "smtp" | "none";
type EmailStatus = "accepted" | "configuration_missing" | "authentication_failed" | "domain_or_recipient_rejected" | "rate_limited" | "timeout" | "provider_failed" | "delivered" | "bounced" | "failed" | "complained";

type TransactionalEmailInput = {
  tenantId?: string | null;
  userId?: string | null;
  to: string;
  type: string;
  template: EmailTemplate;
  metadata?: Record<string, string | number | boolean | null>;
};

type PasswordResetEmailInput = {
  tenantId?: string | null;
  userId?: string | null;
  to: string;
  userName?: string | null;
  resetUrl: string;
  requestId: string;
  expiresInMinutes: number;
};

export type EmailSendResult = {
  provider: EmailProvider;
  status: EmailStatus;
  accepted: boolean;
  messageId?: string;
  requestId?: string;
  errorCode?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStatus(tenantId?: string) {
    const provider = this.provider();
    const recentFailures = tenantId
      ? await this.prisma.emailLog.findMany({
          where: { tenantId, status: { in: ["configuration_missing", "authentication_failed", "domain_or_recipient_rejected", "rate_limited", "timeout", "provider_failed", "bounced", "failed"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, type: true, provider: true, status: true, errorCode: true, createdAt: true }
        }).catch(() => [])
      : [];

    return {
      provider,
      configured: provider !== "none",
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      smtpConfigured: Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.MAIL_FROM)),
      from: this.fromAddress(),
      replyTo: process.env.MAIL_REPLY_TO ?? "support@vtaerp.com",
      publicUrl: this.publicUrl(),
      webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
      recentFailures
    };
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<EmailSendResult> {
    return this.sendTransactionalEmail({
      tenantId: input.tenantId,
      userId: input.userId,
      to: input.to,
      type: "PASSWORD_RESET",
      template: passwordResetTemplate({
        userName: input.userName,
        actionUrl: input.resetUrl,
        expiresInMinutes: input.expiresInMinutes,
        supportEmail: process.env.MAIL_REPLY_TO ?? "support@vtaerp.com"
      }),
      metadata: { requestId: input.requestId, expiresInMinutes: input.expiresInMinutes }
    });
  }

  async sendPasswordChangedEmail(input: { tenantId?: string | null; userId?: string | null; to: string; userName?: string | null }) {
    return this.sendTransactionalEmail({
      tenantId: input.tenantId,
      userId: input.userId,
      to: input.to,
      type: "PASSWORD_CHANGED",
      template: passwordChangedTemplate({ userName: input.userName, supportEmail: process.env.MAIL_REPLY_TO ?? "support@vtaerp.com" })
    });
  }

  async sendTestEmail(input: { tenantId?: string | null; userId?: string | null; to: string }) {
    return this.sendTransactionalEmail({
      tenantId: input.tenantId,
      userId: input.userId,
      to: input.to,
      type: "EMAIL_TEST",
      template: {
        subject: "Test email VTA Commerce",
        text: "Bonjour,\n\nCeci est un email de test VTA Commerce.\n\nVTA Commerce",
        html: "<!doctype html><html><head><meta charset=\"utf-8\"></head><body style=\"font-family:Arial,sans-serif\"><h1>VTA Commerce</h1><p>Ceci est un email de test.</p></body></html>"
      }
    });
  }

  async recordWebhookEvent(input: { provider: "resend"; eventId?: string; eventType: string; messageId?: string; status: EmailStatus; metadata?: Record<string, unknown> }) {
    if (!input.messageId) return { updated: false };
    const existing = await this.prisma.emailLog.findFirst({ where: { provider: input.provider, messageId: input.messageId }, orderBy: { createdAt: "desc" } }).catch(() => null);
    if (!existing) return { updated: false };
    await this.prisma.emailLog.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        metadata: { ...((existing.metadata as Prisma.JsonObject | null) ?? {}), eventId: input.eventId ?? null, eventType: input.eventType } as Prisma.InputJsonValue
      }
    }).catch(() => undefined);
    return { updated: true };
  }

  verifyResendWebhook(headers: Record<string, string | string[] | undefined>, rawBody?: Buffer) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return false;
    const signatureHeader = this.firstHeader(headers["svix-signature"]);
    const id = this.firstHeader(headers["svix-id"]);
    const timestamp = this.firstHeader(headers["svix-timestamp"]);
    if (!signatureHeader || !id || !timestamp || !rawBody) return false;
    const signedPayload = Buffer.concat([Buffer.from(`${id}.${timestamp}.`), rawBody]);
    const secretValue = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "utf8");
    const expected = createHmac("sha256", secretValue).update(signedPayload).digest();
    return signatureHeader.split(" ").some((part) => {
      const value = part.includes(",") ? part.split(",").pop() : part;
      const clean = value?.replace(/^v\d+=/, "");
      if (!clean) return false;
      try {
        const actual = Buffer.from(clean, "base64");
        return actual.length === expected.length && timingSafeEqual(actual, expected);
      } catch {
        return false;
      }
    });
  }

  private async sendTransactionalEmail(input: TransactionalEmailInput): Promise<EmailSendResult> {
    const provider = this.provider();
    const requestId = cryptoRandomId();

    if (provider === "none") {
      const result: EmailSendResult = { provider, status: "configuration_missing", accepted: false, requestId };
      await this.logEmail(input, result);
      this.logger.warn({ event: "transactional_email", type: input.type, provider, status: result.status, requestId });
      return result;
    }

    const result = provider === "resend" ? await this.sendWithResend(input, requestId) : await this.sendWithSmtp(input, requestId);
    await this.logEmail(input, result);
    this.logger.log({ event: "transactional_email", type: input.type, provider: result.provider, status: result.status, accepted: result.accepted, messageId: result.messageId, requestId });
    return result;
  }

  private async sendWithResend(input: TransactionalEmailInput, requestId: string): Promise<EmailSendResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: this.fromAddress(),
          to: [input.to],
          reply_to: process.env.MAIL_REPLY_TO ?? "support@vtaerp.com",
          subject: input.template.subject,
          html: input.template.html,
          text: input.template.text
        })
      });
      const body = await response.json().catch(() => ({} as { id?: string; name?: string; message?: string }));
      if (!response.ok) {
        return { provider: "resend", status: this.mapHttpProviderStatus(response.status), accepted: false, requestId, errorCode: typeof body.name === "string" ? body.name : `HTTP_${response.status}` };
      }
      return { provider: "resend", status: "accepted", accepted: true, requestId, messageId: typeof body.id === "string" ? body.id : undefined };
    } catch (error) {
      return { provider: "resend", status: this.isTimeout(error) ? "timeout" : "provider_failed", accepted: false, requestId, errorCode: this.safeErrorCode(error) };
    }
  }

  private async sendWithSmtp(input: TransactionalEmailInput, requestId: string): Promise<EmailSendResult> {
    const config = this.smtpConfig();
    if (!config) return { provider: "smtp", status: "configuration_missing", accepted: false, requestId };
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      } satisfies SMTPTransport.Options);
      const response = await transporter.sendMail({ from: config.from, to: input.to, replyTo: process.env.MAIL_REPLY_TO, subject: input.template.subject, text: input.template.text, html: input.template.html });
      const accepted = (response.accepted?.length ?? 0) > 0;
      return { provider: "smtp", status: accepted ? "accepted" : "domain_or_recipient_rejected", accepted, messageId: response.messageId, requestId };
    } catch (error) {
      return { provider: "smtp", status: this.mapSmtpError(error), accepted: false, requestId, errorCode: this.safeErrorCode(error) };
    }
  }

  private async logEmail(input: TransactionalEmailInput, result: EmailSendResult) {
    await this.prisma.emailLog.create({
      data: {
        tenantId: input.tenantId ?? undefined,
        userId: input.userId ?? undefined,
        type: input.type,
        provider: result.provider,
        status: result.status,
        messageId: result.messageId,
        errorCode: result.errorCode,
        recipientHash: this.hashRecipient(input.to),
        metadata: { ...(input.metadata ?? {}), requestId: result.requestId ?? null } as Prisma.InputJsonValue
      }
    }).catch(() => undefined);
  }

  private provider(): EmailProvider {
    const selected = (process.env.MAIL_PROVIDER ?? "auto").toLowerCase();
    if ((selected === "resend" || selected === "auto") && process.env.RESEND_API_KEY) return "resend";
    if ((selected === "smtp" || selected === "auto") && this.smtpConfig()) return "smtp";
    return "none";
  }

  private smtpConfig() {
    const host = process.env.SMTP_HOST?.trim();
    const from = (process.env.SMTP_FROM ?? process.env.MAIL_FROM)?.trim();
    const port = Number(process.env.SMTP_PORT ?? "587");
    if (!host || !from || !Number.isFinite(port)) return null;
    return { host, port, from, secure: String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true" || port === 465, user: process.env.SMTP_USER?.trim(), password: process.env.SMTP_PASSWORD };
  }

  private fromAddress() {
    return (process.env.MAIL_FROM ?? process.env.SMTP_FROM ?? "VTA Commerce <noreply@vtaerp.com>").trim();
  }

  private publicUrl() {
    return (process.env.APP_PUBLIC_URL ?? process.env.WEB_URL ?? "https://vtaerp.com").replace(/\/$/, "");
  }

  private mapHttpProviderStatus(status: number): EmailStatus {
    if (status === 401 || status === 403) return "authentication_failed";
    if (status === 422 || status === 400) return "domain_or_recipient_rejected";
    if (status === 429) return "rate_limited";
    if (status >= 500) return "provider_failed";
    return "provider_failed";
  }

  private mapSmtpError(error: unknown): EmailStatus {
    const code = this.safeErrorCode(error);
    const responseCode = typeof error === "object" && error && "responseCode" in error ? Number((error as { responseCode?: unknown }).responseCode) : undefined;
    if (code === "EAUTH") return "authentication_failed";
    if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNECTION") return "timeout";
    if (responseCode === 421 || responseCode === 450 || responseCode === 451 || responseCode === 452) return "rate_limited";
    if (responseCode && responseCode >= 500) return "domain_or_recipient_rejected";
    return "provider_failed";
  }

  private isTimeout(error: unknown) {
    const code = this.safeErrorCode(error);
    return code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNABORTED";
  }

  private safeErrorCode(error: unknown) {
    if (typeof error !== "object" || !error || !("code" in error)) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  private hashRecipient(email: string) {
    return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  }

  private firstHeader(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}

function cryptoRandomId() {
  return createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 16);
}
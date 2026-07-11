import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  requestId: string;
  expiresInMinutes: number;
};

type EmailSendStatus =
  | "accepted"
  | "configuration_missing"
  | "authentication_failed"
  | "domain_or_recipient_rejected"
  | "rate_limited"
  | "timeout"
  | "provider_failed";

export type EmailSendResult = {
  provider: "smtp";
  status: EmailSendStatus;
  accepted: boolean;
  messageId?: string;
  requestId: string;
  errorCode?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<EmailSendResult> {
    const requestId = input.requestId;
    const config = this.smtpConfig();

    if (!config) {
      const result = this.result("configuration_missing", requestId);
      this.logger.warn({ event: "password_reset_email", provider: "smtp", status: result.status, requestId });
      return result;
    }

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

      const response = await transporter.sendMail({
        from: config.from,
        to: input.to,
        subject: "R\u00e9initialisation de votre mot de passe VTA Commerce",
        text: this.textBody(input.resetUrl, input.expiresInMinutes),
        html: this.htmlBody(input.resetUrl, input.expiresInMinutes)
      });

      const accepted = (response.accepted?.length ?? 0) > 0;
      const status = accepted ? "accepted" : "domain_or_recipient_rejected";
      const result: EmailSendResult = { provider: "smtp", status, accepted, messageId: response.messageId, requestId };
      this.logger.log({ event: "password_reset_email", provider: "smtp", status, requestId, messageId: response.messageId });
      return result;
    } catch (error) {
      const status = this.mapSmtpError(error);
      const errorCode = this.safeErrorCode(error);
      const result: EmailSendResult = { provider: "smtp", status, accepted: false, requestId, errorCode };
      this.logger.error({ event: "password_reset_email", provider: "smtp", status, requestId, errorCode });
      return result;
    }
  }

  private smtpConfig() {
    const host = process.env.SMTP_HOST?.trim();
    const from = (process.env.SMTP_FROM ?? process.env.MAIL_FROM)?.trim();
    const port = Number(process.env.SMTP_PORT ?? "587");

    if (!host || !from || !Number.isFinite(port)) return null;

    return {
      host,
      port,
      from,
      secure: String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true" || port === 465,
      user: process.env.SMTP_USER?.trim(),
      password: process.env.SMTP_PASSWORD
    };
  }

  private result(status: EmailSendStatus, requestId: string): EmailSendResult {
    return { provider: "smtp", status, accepted: false, requestId };
  }

  private mapSmtpError(error: unknown): EmailSendStatus {
    const code = this.safeErrorCode(error);
    const responseCode = typeof error === "object" && error && "responseCode" in error ? Number((error as { responseCode?: unknown }).responseCode) : undefined;

    if (code === "EAUTH") return "authentication_failed";
    if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNECTION") return "timeout";
    if (responseCode === 421 || responseCode === 450 || responseCode === 451 || responseCode === 452) return "rate_limited";
    if (responseCode && responseCode >= 500) return "domain_or_recipient_rejected";
    return "provider_failed";
  }

  private safeErrorCode(error: unknown) {
    if (typeof error !== "object" || !error || !("code" in error)) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  private textBody(resetUrl: string, expiresInMinutes: number) {
    return [
      "Bonjour,",
      "",
      "Vous avez demand\u00e9 la r\u00e9initialisation de votre mot de passe VTA Commerce.",
      `Ce lien expire dans ${expiresInMinutes} minutes :`,
      resetUrl,
      "",
      "Si vous n\u0027\u00eates pas \u00e0 l\u0027origine de cette demande, ignorez simplement cet email.",
      "",
      "VTA Commerce"
    ].join("\n");
  }

  private htmlBody(resetUrl: string, expiresInMinutes: number) {
    return [
      "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:560px;margin:0 auto;padding:24px\">",
      "<h1 style=\"font-size:22px;margin:0 0 12px\">R\u00e9initialisation du mot de passe</h1>",
      "<p>Vous avez demand\u00e9 la r\u00e9initialisation de votre mot de passe VTA Commerce.</p>",
      `<p>Ce lien expire dans <strong>${expiresInMinutes} minutes</strong>.</p>`,
      `<p><a href=\"${this.escapeHtml(resetUrl)}\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700\">R\u00e9initialiser mon mot de passe</a></p>`,
      `<p style=\"font-size:13px;color:#475569\">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${this.escapeHtml(resetUrl)}</p>`,
      "<p style=\"font-size:13px;color:#475569\">Si vous n\u0027\u00eates pas \u00e0 l\u0027origine de cette demande, ignorez simplement cet email.</p>",
      "</div>"
    ].join("");
  }

  private escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }
}
const fs = require('fs');
const assert = require('assert');

const auth = fs.readFileSync('apps/api/src/auth/auth.service.ts', 'utf8');
const email = fs.readFileSync('apps/api/src/email/email.service.ts', 'utf8');
const templates = fs.readFileSync('apps/api/src/email/email.templates.ts', 'utf8');
const controller = fs.readFileSync('apps/api/src/email/email.controller.ts', 'utf8');
const authController = fs.readFileSync('apps/api/src/auth/auth.controller.ts', 'utf8');
const schema = fs.readFileSync('database/prisma/schema.prisma', 'utf8');
const env = fs.readFileSync('.env.example', 'utf8');

function includes(source, pattern, message) {
  assert(source.includes(pattern), message);
}

includes(authController, 'forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() request: Request)', 'forgot-password must capture request metadata');
includes(authController, 'this.clientMeta(request)', 'forgot-password must pass IP/user-agent metadata');
includes(auth, 'passwordResetTokenTtlMinutes = 30', 'reset token TTL must be 30 minutes');
includes(auth, 'randomBytes(32).toString("base64url")', 'reset token must be cryptographically random');
includes(auth, 'tokenHash: this.hashPasswordResetToken(rawToken)', 'only hashed reset token may be stored');
assert(!/token:\s*rawToken/.test(auth), 'raw reset token must never be stored');
includes(auth, 'passwordResetToken.updateMany', 'old reset tokens must be invalidated');
includes(auth, 'this.invalidateUserSessions(token.userId)', 'sessions must be invalidated after password reset');
includes(auth, 'sendPasswordChangedEmail', 'password change confirmation email must be sent after reset');
includes(auth, 'canRequestPasswordReset', 'rate limiting must exist');
includes(auth, 'PASSWORD_RESET_ALLOWED_HOSTS', 'reset URL must be restricted to allowed hosts');
includes(auth, 'process.env.NODE_ENV === "production" && url.protocol !== "https:"', 'production reset URLs must use HTTPS');
includes(auth, 'APP_PUBLIC_URL', 'reset URL must support APP_PUBLIC_URL');
includes(email, 'https://api.resend.com/emails', 'Resend provider must be implemented server-side');
includes(email, 'Authorization: `Bearer ${process.env.RESEND_API_KEY}`', 'Resend key must be read only server-side');
includes(email, 'nodemailer.createTransport', 'SMTP fallback must remain available');
includes(email, 'configuration_missing', 'missing email configuration must be logged internally');
includes(email, 'authentication_failed', 'provider authentication errors must be classified');
includes(email, 'domain_or_recipient_rejected', 'domain/recipient rejection errors must be classified');
includes(email, 'messageId', 'provider message id must be logged when available');
includes(email, 'recipientHash', 'recipient must be logged as a hash');
includes(email, 'verifyResendWebhook', 'Resend webhook signature verification must exist');
includes(controller, '@Post("webhooks/resend")', 'Resend webhook endpoint must exist');
includes(controller, 'assertCanManageEmails', 'email settings endpoints must be protected');
includes(schema, 'model EmailLog', 'EmailLog model must exist');
includes(schema, 'recipientHash String?', 'EmailLog must store recipient hash, not raw email');
includes(templates, 'Réinitialiser mon mot de passe', 'password reset template must be in French');
includes(templates, 'Votre mot de passe VTA Commerce a été modifié', 'password changed template must exist');
assert(!/SMTP_PASSWORD.*logger|RESEND_API_KEY.*logger|password.*logger|token.*logger/i.test(email + auth), 'logs must not include secrets or raw tokens');
includes(env, 'RESEND_API_KEY', 'RESEND_API_KEY must be documented');
includes(env, 'MAIL_FROM', 'MAIL_FROM must be documented');
includes(env, 'MAIL_REPLY_TO', 'MAIL_REPLY_TO must be documented');
includes(env, 'PASSWORD_RESET_URL', 'PASSWORD_RESET_URL must be documented');

console.log('password-reset-smoke: ok');
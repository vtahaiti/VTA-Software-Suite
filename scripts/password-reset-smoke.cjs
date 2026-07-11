const fs = require('fs');
const assert = require('assert');

const auth = fs.readFileSync('apps/api/src/auth/auth.service.ts', 'utf8');
const email = fs.readFileSync('apps/api/src/email/email.service.ts', 'utf8');
const controller = fs.readFileSync('apps/api/src/auth/auth.controller.ts', 'utf8');
const env = fs.readFileSync('.env.example', 'utf8');

function includes(source, pattern, message) {
  assert(source.includes(pattern), message);
}

includes(controller, 'forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() request: Request)', 'forgot-password must capture request metadata');
includes(controller, 'this.clientMeta(request)', 'forgot-password must pass IP/user-agent metadata');
includes(auth, 'passwordResetTokenTtlMinutes = 30', 'reset token TTL must be 30 minutes');
includes(auth, 'randomBytes(32).toString("base64url")', 'reset token must be cryptographically random');
includes(auth, 'tokenHash: this.hashPasswordResetToken(rawToken)', 'only hashed reset token may be stored');
assert(!/token:\s*rawToken/.test(auth), 'raw reset token must never be stored');
includes(auth, 'passwordResetToken.updateMany', 'old reset tokens must be invalidated');
includes(auth, 'this.invalidateUserSessions(token.userId)', 'sessions must be invalidated after password reset');
includes(auth, 'canRequestPasswordReset', 'rate limiting must exist');
includes(auth, 'PASSWORD_RESET_ALLOWED_HOSTS', 'reset URL must be restricted to allowed hosts');
includes(auth, 'process.env.NODE_ENV === "production" && url.protocol !== "https:"', 'production reset URLs must use HTTPS');
includes(email, 'nodemailer.createTransport', 'SMTP provider must be called through Nodemailer');
includes(email, 'configuration_missing', 'missing email configuration must be logged internally');
includes(email, 'authentication_failed', 'SMTP authentication errors must be classified');
includes(email, 'domain_or_recipient_rejected', 'SMTP rejection errors must be classified');
includes(email, 'messageId', 'provider message id must be logged when available');
assert(!/SMTP_PASSWORD.*logger|password.*logger|token.*logger/i.test(email + auth), 'logs must not include secrets or raw tokens');
includes(env, 'SMTP_HOST', 'SMTP_HOST must be documented');
includes(env, 'SMTP_PASSWORD', 'SMTP_PASSWORD must be documented without value');
includes(env, 'SMTP_FROM', 'SMTP_FROM must be documented');
includes(env, 'PASSWORD_RESET_BASE_URL', 'PASSWORD_RESET_BASE_URL must be documented');

console.log('password-reset-smoke: ok');

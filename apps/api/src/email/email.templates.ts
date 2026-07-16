export type EmailTemplateInput = {
  appName?: string;
  userName?: string | null;
  companyName?: string | null;
  actionUrl?: string;
  expiresInMinutes?: number;
  supportEmail?: string;
};

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

const brandName = "VTA Commerce";

export function passwordResetTemplate(input: EmailTemplateInput): EmailTemplate {
  const supportEmail = input.supportEmail ?? "support@vtaerp.com";
  const greeting = input.userName ? `Bonjour ${input.userName},` : "Bonjour,";
  const expires = input.expiresInMinutes ?? 30;
  const actionUrl = input.actionUrl ?? "https://vtaerp.com/reset-password";
  return {
    subject: "Réinitialisation de votre mot de passe VTA Commerce",
    text: [
      greeting,
      "",
      "Vous avez demandé la réinitialisation de votre mot de passe VTA Commerce.",
      `Ce lien expire dans ${expires} minutes :`,
      actionUrl,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email ou contactez le support.",
      `Support : ${supportEmail}`,
      "",
      brandName
    ].join("\n"),
    html: layout(`
      <p>${escapeHtml(greeting)}</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe VTA Commerce.</p>
      <p>Ce lien expire dans <strong>${expires} minutes</strong>.</p>
      <p><a class="button" href="${escapeHtml(actionUrl)}">Réinitialiser mon mot de passe</a></p>
      <p class="muted">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${escapeHtml(actionUrl)}</p>
      <p class="muted">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email ou contactez <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    `)
  };
}

export function passwordChangedTemplate(input: EmailTemplateInput): EmailTemplate {
  const supportEmail = input.supportEmail ?? "support@vtaerp.com";
  const greeting = input.userName ? `Bonjour ${input.userName},` : "Bonjour,";
  return {
    subject: "Votre mot de passe VTA Commerce a été modifié",
    text: [greeting, "", "Votre mot de passe VTA Commerce vient d'être modifié.", "Si vous n'êtes pas à l'origine de cette action, contactez immédiatement le support.", `Support : ${supportEmail}`, "", brandName].join("\n"),
    html: layout(`
      <p>${escapeHtml(greeting)}</p>
      <p>Votre mot de passe VTA Commerce vient d'être modifié.</p>
      <p class="muted">Si vous n'êtes pas à l'origine de cette action, contactez immédiatement <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
    `)
  };
}

export function welcomeTemplate(input: EmailTemplateInput): EmailTemplate {
  const greeting = input.userName ? `Bonjour ${input.userName},` : "Bonjour,";
  return {
    subject: "Bienvenue sur VTA Commerce",
    text: [greeting, "", "Votre espace VTA Commerce est prêt.", "", brandName].join("\n"),
    html: layout(`<p>${escapeHtml(greeting)}</p><p>Votre espace VTA Commerce est prêt.</p>`)
  };
}

export function companyWelcomeTemplate(input: EmailTemplateInput): EmailTemplate {
  const greeting = input.userName ? `Bonjour ${input.userName},` : "Bonjour,";
  const companyLine = input.companyName ? `Votre espace ${input.companyName} est pret sur VTA Commerce.` : "Votre espace VTA Commerce est pret.";
  const actionUrl = input.actionUrl ?? "https://vtaerp.com/login";
  const supportEmail = input.supportEmail ?? "support@vtaerp.com";
  return {
    subject: "Bienvenue sur VTA Commerce",
    text: [
      greeting,
      "",
      companyLine,
      "Vous pouvez maintenant vous connecter et commencer a configurer vos produits, vos clients et vos ventes.",
      "",
      `Connexion : ${actionUrl}`,
      `Support : ${supportEmail}`,
      "",
      "Pour votre securite, VTA Commerce ne vous demandera jamais votre mot de passe par email.",
      "",
      brandName
    ].join("\n"),
    html: layout(`<p>${escapeHtml(greeting)}</p><p>${escapeHtml(companyLine)}</p><p>Vous pouvez maintenant vous connecter et commencer a configurer vos produits, vos clients et vos ventes.</p><p><a class="button" href="${escapeHtml(actionUrl)}">Se connecter a VTA Commerce</a></p><p class="muted">Support : <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></p><p class="muted">Pour votre securite, VTA Commerce ne vous demandera jamais votre mot de passe par email.</p>`)
  };
}

export function userInvitationTemplate(input: EmailTemplateInput): EmailTemplate {
  const actionUrl = input.actionUrl ?? "https://vtaerp.com/login";
  return {
    subject: "Invitation à rejoindre VTA Commerce",
    text: ["Bonjour,", "", "Vous avez été invité à rejoindre un espace VTA Commerce.", actionUrl, "", brandName].join("\n"),
    html: layout(`<p>Vous avez été invité à rejoindre un espace VTA Commerce.</p><p><a class="button" href="${escapeHtml(actionUrl)}">Accepter l'invitation</a></p>`)
  };
}

export function securityAlertTemplate(input: EmailTemplateInput): EmailTemplate {
  const supportEmail = input.supportEmail ?? "security@vtaerp.com";
  return {
    subject: "Alerte de sécurité VTA Commerce",
    text: ["Bonjour,", "", "Une activité importante a été détectée sur votre compte.", `Support sécurité : ${supportEmail}`, "", brandName].join("\n"),
    html: layout(`<p>Une activité importante a été détectée sur votre compte.</p><p class="muted">Support sécurité : <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></p>`)
  };
}

export function invoiceTemplate(): EmailTemplate {
  return {
    subject: "Document VTA Commerce",
    text: ["Bonjour,", "", "Un document VTA Commerce est disponible.", "", brandName].join("\n"),
    html: layout("<p>Un document VTA Commerce est disponible.</p>")
  };
}

function layout(content: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif}.container{max-width:580px;margin:0 auto;padding:28px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px}.brand{font-size:18px;font-weight:800;color:#2563eb;margin-bottom:18px}.button{display:inline-block;background:#2563eb;color:#fff!important;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700}.muted{color:#64748b;font-size:13px;line-height:1.6}</style></head><body><div class="container"><div class="card"><div class="brand">${brandName}</div>${content}<p class="muted">© ${new Date().getFullYear()} VTA Commerce</p></div></div></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

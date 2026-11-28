import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
  replyTo?: string;
}

const supportEmail = () => process.env.SUPPORT_EMAIL?.trim() || process.env.MAIL_REPLY_TO?.trim() || 'sbusisiwemawande@gmail.com';

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] ?? character);
}

function linkify(value: string) {
  return value.replace(/(https?:\/\/[^\s<]+)/g, url => `<a href="${url}" style="color:#166534;text-decoration:underline">${url}</a>`);
}

function textToHtml(text: string) {
  const support = escapeHtml(supportEmail());
  const paragraphs = text.split(/\n{2,}/).map(paragraph => `<p style="margin:0 0 14px">${linkify(escapeHtml(paragraph)).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f7f4">
    <div style="max-width:560px;margin:0 auto;padding:28px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.65">
      <p style="margin:0 0 22px;font-size:18px;font-weight:700;color:#14532d">ServiceConnect</p>
      ${paragraphs}
      <hr style="border:0;border-top:1px solid #dbe5dc;margin:24px 0 14px">
      <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5">ServiceConnect · Verulam, South Africa<br>Questions? <a href="mailto:${support}" style="color:#166534">${support}</a></p>
    </div>
  </body></html>`;
}

function textWithFooter(text: string) {
  return `${text}\n\n--\nServiceConnect · Verulam, South Africa\nQuestions? ${supportEmail()}`;
}

/**
 * Sends transactional email. Resend is preferred when configured; the Gmail
 * fallback exists only for small deployments and is not recommended for
 * production deliverability.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private warnedAboutGmail = false;

  isConfigured() {
    return Boolean(
      (process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim())
      || (process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()),
    );
  }

  async send(message: MailMessage): Promise<boolean> {
    const text = textWithFooter(message.text);
    const html = message.html ?? textToHtml(message.text);
    const replyTo = message.replyTo?.trim() || process.env.MAIL_REPLY_TO?.trim() || supportEmail();
    const headers = {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All',
    };

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim();
    if (apiKey && from) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}) },
          body: JSON.stringify({ from, to: [message.to], subject: message.subject, text, html, reply_to: replyTo }),
        });
        if (!response.ok) {
          this.logger.error(`Email provider returned ${response.status}.`);
          return false;
        }
        return true;
      } catch {
        this.logger.error('Email could not be delivered through Resend.');
        return false;
      }
    }

    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
    if (gmailUser && gmailPassword) {
      if (!this.warnedAboutGmail) {
        this.warnedAboutGmail = true;
        this.logger.warn('Using Gmail SMTP fallback. Automated mail from a personal Gmail account is likely to be marked as spam; configure RESEND_API_KEY and MAIL_FROM with a verified domain for production.');
      }
      try {
        const transport = createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPassword }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
        await transport.sendMail({ from: `ServiceConnect <${gmailUser}>`, to: message.to, subject: message.subject, text, html, replyTo, headers });
        return true;
      } catch {
        this.logger.error('Email could not be delivered through Gmail.');
        return false;
      }
    }

    this.logger.warn('Email not sent: configure RESEND_API_KEY and MAIL_FROM (recommended) or GMAIL_USER and GMAIL_APP_PASSWORD.');
    return false;
  }
}

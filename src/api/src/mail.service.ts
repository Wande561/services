import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends transactional email through Resend. When credentials are absent the
 * service is a no-op so local development and preview deployments still work.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  isConfigured() {
    return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
  }

  async send(message: MailMessage): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim();
    if (!apiKey || !from) {
      this.logger.warn('Email not sent: configure RESEND_API_KEY and MAIL_FROM.');
      return false;
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      });
      if (!response.ok) {
        this.logger.error(`Email provider returned ${response.status}.`);
        return false;
      }
      return true;
    } catch {
      this.logger.error('Email could not be delivered.');
      return false;
    }
  }
}

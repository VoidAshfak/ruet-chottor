import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends email over SMTP (`SMTP_URL`). In development without `SMTP_URL`, mail goes to a throwaway
 * Ethereal inbox and only the preview link is logged, never the message body (ADR 0004).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Promise<Transporter> | undefined;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(message: MailMessage): Promise<void> {
    const transporter = await this.getTransporter();
    const info = await transporter.sendMail({
      from: this.config.get('MAIL_FROM', { infer: true }),
      ...message,
    });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) this.logger.log(`Dev email preview: ${preview}`);
  }

  private getTransporter(): Promise<Transporter> {
    this.transporter ??= this.createTransporter().catch((error: unknown) => {
      this.transporter = undefined; // retry on the next send
      throw error;
    });
    return this.transporter;
  }

  private async createTransporter(): Promise<Transporter> {
    const smtpUrl = this.config.get('SMTP_URL', { infer: true });
    if (smtpUrl) return nodemailer.createTransport(smtpUrl);

    // env.ts requires SMTP_URL in production, so this is development only.
    const account = await nodemailer.createTestAccount();
    this.logger.log('SMTP_URL not set: sending email to an Ethereal test inbox');
    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });
  }
}

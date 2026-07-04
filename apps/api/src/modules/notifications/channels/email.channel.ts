import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notification } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import mjml2html from 'mjml';
import * as nodemailer from 'nodemailer';
import { NotificationChannel, NotificationRecipient } from './notification-channel';

/**
 * Email channel: bilingual (ar RTL + en LTR) MJML templates delivered over SMTP
 * (MailHog in dev). Rendering failures never break the request — delivery is
 * best-effort and logged.
 */
@Injectable()
export class EmailNotificationChannel implements NotificationChannel {
  readonly name = 'email';
  private readonly logger = new Logger(EmailNotificationChannel.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {
    this.from = this.config.get<string>('SMTP_FROM') ?? 'no-reply@tftsp.local';
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
      port: parseInt(this.config.get<string>('SMTP_PORT') ?? '1025', 10),
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  async deliver(notification: Notification, recipient: NotificationRecipient): Promise<void> {
    try {
      const subjectAr = this.t(notification, 'ar', 'subject');
      const subjectEn = this.t(notification, 'en', 'subject');
      const bodyAr = this.t(notification, 'ar', 'body');
      const bodyEn = this.t(notification, 'en', 'body');

      const { html } = mjml2html(
        this.buildMjml(recipient.fullName, subjectAr, bodyAr, subjectEn, bodyEn),
        { validationLevel: 'skip' },
      );

      await this.transporter.sendMail({
        from: this.from,
        to: recipient.email,
        subject: `${subjectAr} — ${subjectEn}`,
        html,
      });
    } catch (err) {
      this.logger.warn(`Email delivery skipped/failed for ${recipient.email}: ${String(err)}`);
    }
  }

  private t(notification: Notification, lang: 'ar' | 'en', part: 'subject' | 'body'): string {
    const key = `notifications.${notification.type}.${part}`;
    return this.i18n.t(key, {
      lang,
      args: notification.payload as Record<string, unknown>,
      defaultValue: key,
    });
  }

  private buildMjml(
    name: string,
    subjectAr: string,
    bodyAr: string,
    subjectEn: string,
    bodyEn: string,
  ): string {
    return `
      <mjml>
        <mj-body background-color="#f4f4f4">
          <mj-section background-color="#ffffff">
            <mj-column>
              <mj-text align="right" css-class="rtl" font-size="18px" font-weight="bold">${subjectAr}</mj-text>
              <mj-text align="right">${name}،</mj-text>
              <mj-text align="right">${bodyAr}</mj-text>
              <mj-divider border-color="#dddddd" />
              <mj-text align="left" font-size="18px" font-weight="bold">${subjectEn}</mj-text>
              <mj-text align="left">${name},</mj-text>
              <mj-text align="left">${bodyEn}</mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>`;
  }
}

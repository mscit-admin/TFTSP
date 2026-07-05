import { Injectable, Logger } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { DeviceRepository } from '../../devices/device.repository';
import { FcmService } from './fcm.service';
import { NotificationChannel, NotificationRecipient } from './notification-channel';

/**
 * FCM channel (Spec §3·M5.7) — the third NotificationChannel alongside in-app
 * WebSocket + email. Pushes to every device the recipient has registered, with a
 * data block carrying the notification `type` + `payload` so a tap deep-opens the
 * item. No-ops when FCM is disabled; prunes tokens FCM reports as unregistered.
 */
@Injectable()
export class FcmNotificationChannel implements NotificationChannel {
  readonly name = 'fcm';
  private readonly logger = new Logger(FcmNotificationChannel.name);

  constructor(
    private readonly fcm: FcmService,
    private readonly devices: DeviceRepository,
    private readonly i18n: I18nService,
  ) {}

  async deliver(notification: Notification, recipient: NotificationRecipient): Promise<void> {
    if (!this.fcm.isEnabled()) {
      return; // disabled in dev/CI — safe no-op
    }
    const rows = await this.devices.listTokensForUser(recipient.userId);
    const tokens = rows.map((r) => r.token);
    if (tokens.length === 0) {
      return;
    }

    const payload = {
      ...((notification.payload as Record<string, unknown>) ?? {}),
      notificationId: notification.id,
      type: notification.type,
    };

    const { invalidTokens } = await this.fcm.send(tokens, {
      type: notification.type,
      title: this.t(notification, recipient.locale, 'subject'),
      body: this.t(notification, recipient.locale, 'body'),
      payload,
    });

    if (invalidTokens.length > 0) {
      const pruned = await this.devices.deleteByTokens(invalidTokens);
      this.logger.debug(`Pruned ${pruned} unregistered FCM token(s).`);
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
}

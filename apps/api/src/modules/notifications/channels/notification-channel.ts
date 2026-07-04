import { Notification } from '@prisma/client';

export interface NotificationRecipient {
  userId: string;
  email: string;
  fullName: string;
  locale: 'ar' | 'en';
}

/**
 * Delivery-channel abstraction (Spec §3 M2). New channels (SMS/WhatsApp/etc. —
 * Backlog) plug in without touching the notification service.
 */
export interface NotificationChannel {
  readonly name: string;
  deliver(notification: Notification, recipient: NotificationRecipient): Promise<void>;
}

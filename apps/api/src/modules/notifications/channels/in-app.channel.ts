import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { NotificationGateway } from '../notification.gateway';
import { NotificationChannel, NotificationRecipient } from './notification-channel';

/** In-app channel: pushes the persisted notification over Socket.IO. */
@Injectable()
export class InAppNotificationChannel implements NotificationChannel {
  readonly name = 'in-app';

  constructor(private readonly gateway: NotificationGateway) {}

  async deliver(notification: Notification, _recipient: NotificationRecipient): Promise<void> {
    this.gateway.emitToUser(notification);
  }
}

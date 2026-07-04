import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { AuthRepository } from '../auth/auth.repository';
import { NOTIFICATION_CHANNELS } from './notification.constants';
import { NotificationChannel, NotificationRecipient } from './channels/notification-channel';
import { NotificationRepository } from './notification.repository';
import { ListNotificationsDto } from './dto/list-notifications.dto';

export interface NotifyParams {
  tenantId: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}

export interface NotificationListResult {
  data: Notification[];
  unread: number;
  page: number;
  pageSize: number;
  total: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly defaultLocale: 'ar' | 'en';

  constructor(
    private readonly repo: NotificationRepository,
    private readonly authRepo: AuthRepository,
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {
    this.defaultLocale = (this.config.get<string>('DEFAULT_LOCALE') ?? 'ar') as 'ar' | 'en';
  }

  /**
   * Persist a notification and fan it out to every channel (in-app ≤2s + email).
   * Persistence is authoritative; channel delivery is best-effort and isolated.
   */
  async notify(params: NotifyParams): Promise<Notification> {
    const notification = await this.repo.create(
      params.tenantId,
      params.userId,
      params.type,
      params.payload as Prisma.InputJsonValue,
    );

    const recipient = await this.resolveRecipient(params.userId);
    await Promise.all(
      this.channels.map((channel) =>
        channel.deliver(notification, recipient).catch((err) => {
          this.logger.warn(`Channel ${channel.name} failed: ${String(err)}`);
        }),
      ),
    );
    return notification;
  }

  /** Notify several users of the same event (e.g. all reviewers on submit). */
  async notifyMany(
    tenantId: string,
    userIds: string[],
    type: NotificationType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await Promise.all(
      [...new Set(userIds)].map((userId) => this.notify({ tenantId, userId, type, payload })),
    );
  }

  async list(userId: string, dto: ListNotificationsDto): Promise<NotificationListResult> {
    const skip = (dto.page - 1) * dto.pageSize;
    const [data, total, unread] = await Promise.all([
      this.repo.list(userId, skip, dto.pageSize),
      this.repo.count(userId),
      this.repo.unreadCount(userId),
    ]);
    return { data, unread, page: dto.page, pageSize: dto.pageSize, total };
  }

  async markRead(userId: string, id: string): Promise<{ updated: number }> {
    return { updated: await this.repo.markRead(id, userId) };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.repo.markAllRead(userId) };
  }

  private async resolveRecipient(userId: string): Promise<NotificationRecipient> {
    const user = await this.authRepo.findUserById(userId);
    return {
      userId,
      email: user?.email ?? `${userId}@unknown.local`,
      fullName: user?.fullName ?? '',
      locale: this.defaultLocale,
    };
  }
}

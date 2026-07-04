import { Injectable } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Notifications are created server-side (never from user input), so writes use
 * the platform (owner) client with an EXPLICIT tenantId — this also lets the
 * BullMQ jobs (no HTTP/tenant context) create them. Reads/mark-read use the RLS
 * app client scoped to the current user.
 */
@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    tenantId: string,
    userId: string,
    type: NotificationType,
    payload: Prisma.InputJsonValue,
  ): Promise<Notification> {
    return this.prisma.platform.notification.create({
      data: { tenantId, userId, type, payload },
    });
  }

  list(userId: string, skip: number, take: number): Promise<Notification[]> {
    return this.prisma.tenant.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(userId: string): Promise<number> {
    return this.prisma.tenant.notification.count({ where: { userId } });
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.tenant.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string): Promise<number> {
    const res = await this.prisma.tenant.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return res.count;
  }

  async markAllRead(userId: string): Promise<number> {
    const res = await this.prisma.tenant.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return res.count;
  }
}

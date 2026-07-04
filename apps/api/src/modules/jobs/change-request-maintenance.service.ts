import { Injectable, Logger } from '@nestjs/common';
import { ChangeRequestStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { EXPIRY_WARNING_DAYS } from './jobs.constants';

const NON_TERMINAL: ChangeRequestStatus[] = [
  ChangeRequestStatus.draft,
  ChangeRequestStatus.submitted,
  ChangeRequestStatus.under_review,
  ChangeRequestStatus.changes_requested,
];

/**
 * Cross-tenant maintenance for change requests. Redis-free so it can be invoked
 * directly (tests) or driven by the BullMQ scheduler. Uses the platform (owner)
 * client because it spans every tenant with no HTTP/tenant context; notifications
 * are created with explicit tenantId (Spec §3 M2 scheduled jobs).
 */
@Injectable()
export class ChangeRequestMaintenanceService {
  private readonly logger = new Logger(ChangeRequestMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /** Close requests past their expiry and notify their owners. Returns count closed. */
  async runExpirySweep(now: Date = new Date()): Promise<number> {
    const expired = await this.prisma.platform.changeRequest.findMany({
      where: { expiresAt: { lt: now }, status: { in: NON_TERMINAL } },
      select: { id: true, tenantId: true, createdBy: true, targetType: true, operation: true },
    });

    for (const cr of expired) {
      await this.prisma.platform.changeRequest.update({
        where: { id: cr.id },
        data: { status: ChangeRequestStatus.expired },
      });
      await this.notifications.notify({
        tenantId: cr.tenantId,
        userId: cr.createdBy,
        type: NotificationType.change_request_expired,
        payload: { changeRequestId: cr.id, targetType: cr.targetType, operation: cr.operation },
      });
    }
    if (expired.length > 0) {
      this.logger.log(`Expiry sweep closed ${expired.length} change request(s).`);
    }
    return expired.length;
  }

  /** Warn owners of requests entering the final `EXPIRY_WARNING_DAYS` window. */
  async runExpiryWarning(now: Date = new Date()): Promise<number> {
    const windowStart = new Date(now.getTime() + (EXPIRY_WARNING_DAYS - 1) * 86_400_000);
    const windowEnd = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);

    const soon = await this.prisma.platform.changeRequest.findMany({
      where: {
        status: { in: NON_TERMINAL },
        expiresAt: { gte: windowStart, lt: windowEnd },
      },
      select: { id: true, tenantId: true, createdBy: true, targetType: true, operation: true },
    });

    for (const cr of soon) {
      await this.notifications.notify({
        tenantId: cr.tenantId,
        userId: cr.createdBy,
        type: NotificationType.change_request_expiring,
        payload: { changeRequestId: cr.id, targetType: cr.targetType, operation: cr.operation },
      });
    }
    return soon.length;
  }
}

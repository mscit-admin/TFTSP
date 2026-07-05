import { Injectable } from '@nestjs/common';
import { DeviceRegistration } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DeviceRepository } from './device.repository';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DeviceService {
  constructor(
    private readonly repo: DeviceRepository,
    private readonly audit: AuditService,
  ) {}

  /** Register or refresh the caller's device token (upsert by token). */
  async register(userId: string, dto: RegisterDeviceDto): Promise<DeviceRegistration> {
    const device = await this.repo.upsertByToken(userId, dto.token, dto.platform);
    await this.audit.record({
      action: 'device.register',
      entityType: 'DeviceRegistration',
      entityId: device.id,
      after: { userId, platform: device.platform },
    });
    return device;
  }

  /** Deregister on logout. Idempotent — a missing/foreign token is a no-op. */
  async deregister(userId: string, token: string): Promise<{ removed: number }> {
    const removed = await this.repo.deleteOwnToken(userId, token);
    if (removed > 0) {
      await this.audit.record({
        action: 'device.deregister',
        entityType: 'DeviceRegistration',
        entityId: null,
        before: { userId },
      });
    }
    return { removed };
  }
}

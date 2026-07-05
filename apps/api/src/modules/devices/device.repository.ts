import { Injectable } from '@nestjs/common';
import { DeviceRegistration, DevicePlatform } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

/** Tenant-scoped (RLS). One row per FCM token (unique). */
@Injectable()
export class DeviceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Upsert by token: a physical device holds one FCM token, so re-registering the
   * same token (token refresh, or the device handed to another user in the tribe)
   * refreshes owner/tenant/platform/lastSeenAt instead of creating a duplicate.
   */
  upsertByToken(
    userId: string,
    token: string,
    platform: DevicePlatform,
  ): Promise<DeviceRegistration> {
    const tenantId = this.tenantContext.requireTenantId();
    const now = new Date();
    return this.prisma.tenant.deviceRegistration.upsert({
      where: { token },
      create: { tenantId, userId, token, platform, lastSeenAt: now },
      update: { tenantId, userId, platform, lastSeenAt: now },
    });
  }

  findByToken(token: string): Promise<DeviceRegistration | null> {
    return this.prisma.tenant.deviceRegistration.findFirst({ where: { token } });
  }

  /** Delete a single token (owner-scoped so a member only drops their own device). */
  async deleteOwnToken(userId: string, token: string): Promise<number> {
    const { count } = await this.prisma.tenant.deviceRegistration.deleteMany({
      where: { token, userId },
    });
    return count;
  }

  listTokensForUser(userId: string): Promise<Array<{ token: string }>> {
    return this.prisma.tenant.deviceRegistration.findMany({
      where: { userId },
      select: { token: true },
    });
  }

  /** Prune tokens FCM reported as unregistered (system hygiene, not user-initiated). */
  async deleteByTokens(tokens: string[]): Promise<number> {
    if (tokens.length === 0) {
      return 0;
    }
    const { count } = await this.prisma.tenant.deviceRegistration.deleteMany({
      where: { token: { in: tokens } },
    });
    return count;
  }
}

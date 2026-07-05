import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionActivation, TenantSubscription } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Subscriptions are platform-level (like Tenant, OUTSIDE RLS) — all access uses
 * the owner client with an explicit tenantId. The plan-cap guard runs during
 * tenant requests but still reads subscriptions via the owner client.
 */
@Injectable()
export class SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  get(tenantId: string): Promise<TenantSubscription | null> {
    return this.prisma.platform.tenantSubscription.findUnique({ where: { tenantId } });
  }

  upsert(
    tenantId: string,
    create: Prisma.TenantSubscriptionUncheckedCreateInput,
    update: Prisma.TenantSubscriptionUncheckedUpdateInput,
  ): Promise<TenantSubscription> {
    return this.prisma.platform.tenantSubscription.upsert({
      where: { tenantId },
      create,
      update,
    });
  }

  addActivation(
    data: Prisma.SubscriptionActivationUncheckedCreateInput,
  ): Promise<SubscriptionActivation> {
    return this.prisma.platform.subscriptionActivation.create({ data });
  }

  listActivations(tenantId: string): Promise<SubscriptionActivation[]> {
    return this.prisma.platform.subscriptionActivation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  personCount(tenantId: string): Promise<number> {
    return this.prisma.platform.person.count({ where: { tenantId, deletedAt: null } });
  }
}

import { Injectable } from '@nestjs/common';
import {
  PlanTier,
  SubscriptionActivation,
  SubscriptionStatus,
  TenantSubscription,
} from '@prisma/client';
import { PLAN_LIMITS } from './plan-limits';
import { PaymentGateway } from './payment-gateway';
import { SubscriptionRepository } from './subscription.repository';
import { SetSubscriptionDto } from './dto/subscription.dto';

export interface SubscriptionView extends TenantSubscription {
  maxPersons: number | null;
  currentPersons: number;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly payments: PaymentGateway,
  ) {}

  /** Current subscription (defaults to Free/active if none exists yet). */
  async get(tenantId: string): Promise<SubscriptionView> {
    const existing = await this.repo.get(tenantId);
    const sub =
      existing ??
      ({
        tenantId,
        tier: PlanTier.free,
        status: SubscriptionStatus.active,
        activatedAt: null,
        expiresAt: null,
        activatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TenantSubscription);
    const current = await this.repo.personCount(tenantId);
    return { ...sub, maxPersons: PLAN_LIMITS[sub.tier], currentPersons: current };
  }

  /** Assign a tier + manually activate (Super Admin). Logs a `SubscriptionActivation`. */
  async set(
    tenantId: string,
    dto: SetSubscriptionDto,
    adminUserId: string,
  ): Promise<SubscriptionView> {
    await this.payments.activate(tenantId, dto.tier, dto.note);
    const now = new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    await this.repo.upsert(
      tenantId,
      {
        tenantId,
        tier: dto.tier,
        status: SubscriptionStatus.active,
        activatedAt: now,
        expiresAt,
        activatedBy: adminUserId,
      },
      {
        tier: dto.tier,
        status: SubscriptionStatus.active,
        activatedAt: now,
        expiresAt,
        activatedBy: adminUserId,
      },
    );
    // The activation log is the audit trail for platform-level subscription changes.
    await this.repo.addActivation({
      tenantId,
      tier: dto.tier,
      activatedBy: adminUserId,
      note: dto.note ?? null,
    });
    return this.get(tenantId);
  }

  activations(tenantId: string): Promise<SubscriptionActivation[]> {
    return this.repo.listActivations(tenantId);
  }
}

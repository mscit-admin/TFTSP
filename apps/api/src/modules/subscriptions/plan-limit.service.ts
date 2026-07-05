import { Injectable } from '@nestjs/common';
import { PlanTier } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PLAN_LIMITS } from './plan-limits';
import { SubscriptionRepository } from './subscription.repository';

/**
 * Central plan-cap enforcement (Spec §3·M4.4). Supersedes the M2.5
 * `Tenant.max_persons` stand-in — the cap is derived from the tenant's
 * subscription tier. Enforced on person-create, import publish, and contribution
 * publish. See DECISIONS D-401.
 */
@Injectable()
export class PlanLimitService {
  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  /** Effective tier for a tenant (no subscription row ⇒ free). */
  async tierOf(tenantId: string): Promise<PlanTier> {
    const sub = await this.repo.get(tenantId);
    return sub?.tier ?? PlanTier.free;
  }

  /** Person cap for a tenant; null = unlimited. */
  async maxPersons(tenantId: string): Promise<number | null> {
    return PLAN_LIMITS[await this.tierOf(tenantId)];
  }

  /**
   * Throws `errors.subscription.plan_limit_reached` (with `{ tier, max, current }`)
   * if adding `count` persons would exceed the tenant's cap. Uses the tenant from
   * the request context.
   */
  async assertCanAddPersons(count = 1, tenantId?: string): Promise<void> {
    const tid = tenantId ?? this.tenantContext.requireTenantId();
    const tier = await this.tierOf(tid);
    const max = PLAN_LIMITS[tier];
    if (max === null) {
      return; // enterprise / unlimited
    }
    const current = await this.repo.personCount(tid);
    if (current + count > max) {
      throw AppException.forbidden(ErrorKeys.SUBSCRIPTION_PLAN_LIMIT_REACHED, {
        tier,
        max,
        current,
      });
    }
  }
}

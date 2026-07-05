// Local mirror of packages/shared-types/src/subscription.ts (M4 — DECISIONS D-202 mirror policy).
export type PlanTier = 'free' | 'basic' | 'professional' | 'enterprise';

export interface Plan {
  tier: PlanTier;
  maxPersons: number | null;
  nameAr: string;
  nameEn: string;
}

export const PLAN_LIMITS: Record<PlanTier, number | null> = {
  free: 500,
  basic: 5000,
  professional: 25000,
  enterprise: null,
};

export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

export interface TenantSubscription {
  tenantId: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  activatedAt?: string | null;
  expiresAt?: string | null;
  activatedBy?: string | null;
}

export interface SetSubscriptionDto {
  tier: PlanTier;
  expiresAt?: string;
  note?: string;
}

export interface SubscriptionActivation {
  id: string;
  tenantId: string;
  tier: PlanTier;
  activatedBy: string;
  note?: string | null;
  createdAt: string;
}

/** Backend key + details when a write is blocked by the plan cap (admin-web surfaces this). */
export const PLAN_LIMIT_MESSAGE_KEY = 'errors.subscription.plan_limit_reached';

/** M4 — Subscriptions & plan enforcement (Spec §3·M4.4, §M4.8). */

export type PlanTier = 'free' | 'basic' | 'professional' | 'enterprise';

/** Person-count caps per plan (Spec §M4.4). null = unlimited. */
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

/** A tenant's subscription. Activation is manual (bank transfer) in v1. */
export interface TenantSubscription {
  tenantId: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  /** manual activation window */
  activatedAt?: string | null;
  expiresAt?: string | null;
  activatedBy?: string | null; // platform admin user id
}

/** Platform-web: assign a plan / manually activate (Spec §M4.8). */
export interface SetSubscriptionDto {
  tier: PlanTier;
  expiresAt?: string;
  /** free-text note for the activation log, e.g. bank-transfer ref */
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

/** Returned when a write is blocked by the plan cap (Guard). */
export interface PlanLimitError {
  messageKey: 'errors.subscription.plan_limit_reached';
  details: { tier: PlanTier; max: number; current: number };
}

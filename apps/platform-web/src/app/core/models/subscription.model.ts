/**
 * M4 — Subscriptions & plan enforcement.
 * Mirrored locally from packages/shared-types/src/subscription.ts (Backend owns canonical).
 */

export type PlanTier = 'free' | 'basic' | 'professional' | 'enterprise';

/** Person-count caps per plan (Spec §M4.4). null = unlimited. */
export const PLAN_LIMITS: Record<PlanTier, number | null> = {
  free: 500,
  basic: 5000,
  professional: 25000,
  enterprise: null,
};

/** Fixed display order for tier pickers / breakdowns. */
export const PLAN_TIERS: PlanTier[] = ['free', 'basic', 'professional', 'enterprise'];

export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

/** A tenant's subscription. Activation is manual (bank transfer) in v1. */
export interface TenantSubscription {
  tenantId: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  activatedAt?: string | null;
  expiresAt?: string | null;
  activatedBy?: string | null;
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

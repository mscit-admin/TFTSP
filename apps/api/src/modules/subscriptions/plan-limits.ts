import { PlanTier } from '@prisma/client';

/** Person-count caps per plan (Spec §M4.4). null = unlimited. Mirrors shared-types. */
export const PLAN_LIMITS: Record<PlanTier, number | null> = {
  free: 500,
  basic: 5000,
  professional: 25000,
  enterprise: null,
};

export const PLAN_NAMES: Record<PlanTier, { ar: string; en: string }> = {
  free: { ar: 'مجاني', en: 'Free' },
  basic: { ar: 'أساسي', en: 'Basic' },
  professional: { ar: 'احترافي', en: 'Professional' },
  enterprise: { ar: 'مؤسسي', en: 'Enterprise' },
};

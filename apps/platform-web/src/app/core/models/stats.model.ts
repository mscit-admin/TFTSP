/**
 * M4 — Platform statistics dashboard.
 * Mirrored from packages/shared-types/src/stats.ts (PlatformDashboard, Super Admin).
 * Backed by Materialized Views refreshed hourly.
 */

export interface PlanBreakdown {
  tier: string;
  tribes: number;
}

export interface ExpiringSubscription {
  tenantId: string;
  nameEn: string;
  expiresAt: string;
}

/** Platform-wide dashboard (platform-web, Super Admin). */
export interface PlatformDashboard {
  tribes: number;
  activeTribes: number;
  suspendedTribes: number;
  totalPersons: number;
  totalUsers: number;
  byPlan: PlanBreakdown[];
  /** subscriptions expiring within 30 days */
  expiringSoon: ExpiringSubscription[];
  refreshedAt: string;
}

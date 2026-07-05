/** M4 — Statistics dashboards (Spec §3·M4.5). Backed by Materialized Views refreshed hourly. */

/** Per-tribe dashboard (admin-web). */
export interface TribeStats {
  tenantId: string;
  totalPersons: number;
  livingPersons: number;
  deceasedPersons: number;
  malePersons: number;
  femalePersons: number;
  generations: number;
  unitsCount: number;
  pendingChangeRequests: number;
  contributorsCount: number;
  /** person counts by generation depth from roots */
  byGeneration: Array<{ depth: number; count: number }>;
  refreshedAt: string;
}

/** Platform-wide dashboard (platform-web, Super Admin). */
export interface PlatformDashboard {
  tribes: number;
  activeTribes: number;
  suspendedTribes: number;
  totalPersons: number;
  totalUsers: number;
  byPlan: Array<{ tier: string; tribes: number }>;
  /** subscriptions expiring within 30 days */
  expiringSoon: Array<{ tenantId: string; nameEn: string; expiresAt: string }>;
  refreshedAt: string;
}

/** Tabular export request (Spec §M4.7 — same shape as the import template for round-trip). */
export type TableExportFormat = 'xlsx' | 'csv';

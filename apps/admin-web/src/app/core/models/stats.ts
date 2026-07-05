// Local mirror of packages/shared-types/src/stats.ts (M4 — DECISIONS D-202 mirror policy).

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
  byGeneration: Array<{ depth: number; count: number }>;
  refreshedAt: string;
}

/** Platform-wide dashboard (platform-web, Super Admin) — mirrored for completeness. */
export interface PlatformDashboard {
  tribes: number;
  activeTribes: number;
  suspendedTribes: number;
  totalPersons: number;
  totalUsers: number;
  byPlan: Array<{ tier: string; tribes: number }>;
  expiringSoon: Array<{ tenantId: string; nameEn: string; expiresAt: string }>;
  refreshedAt: string;
}

export type TableExportFormat = 'xlsx' | 'csv';

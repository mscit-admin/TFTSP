import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/tenant/tenant-context';
import { StatsRepository } from './stats.repository';

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

@Injectable()
export class StatsService {
  constructor(
    private readonly repo: StatsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  /** On-demand refresh of the materialized views (admin or scheduled). */
  refresh(): Promise<void> {
    return this.repo.refreshViews();
  }

  async tribeStats(): Promise<TribeStats> {
    const tenantId = this.tenantContext.requireTenantId();
    const [rows, unitsCount, pending, contributors, byGeneration] = await Promise.all([
      this.repo.tribeStatsRow(tenantId),
      this.repo.unitsCount(tenantId),
      this.repo.pendingChangeRequests(tenantId),
      this.repo.contributorsCount(tenantId),
      this.repo.byGeneration(tenantId),
    ]);
    const row = rows[0];
    const generations =
      byGeneration.length > 0 ? Math.max(...byGeneration.map((g) => g.depth)) + 1 : 0;
    return {
      tenantId,
      totalPersons: Number(row?.total_persons ?? 0),
      livingPersons: Number(row?.living_persons ?? 0),
      deceasedPersons: Number(row?.deceased_persons ?? 0),
      malePersons: Number(row?.male_persons ?? 0),
      femalePersons: Number(row?.female_persons ?? 0),
      generations,
      unitsCount,
      pendingChangeRequests: pending,
      contributorsCount: contributors,
      byGeneration,
      refreshedAt: (row?.refreshed_at ?? new Date()).toISOString(),
    };
  }

  async platformDashboard(): Promise<PlatformDashboard> {
    const [rows, byPlan, expiringSoon] = await Promise.all([
      this.repo.platformDashboardRow(),
      this.repo.byPlan(),
      this.repo.expiringSoon(),
    ]);
    const row = rows[0];
    return {
      tribes: Number(row?.tribes ?? 0),
      activeTribes: Number(row?.active_tribes ?? 0),
      suspendedTribes: Number(row?.suspended_tribes ?? 0),
      totalPersons: Number(row?.total_persons ?? 0),
      totalUsers: Number(row?.total_users ?? 0),
      byPlan: byPlan.map((p) => ({ tier: p.tier, tribes: Number(p.count) })),
      expiringSoon: expiringSoon.map((e) => ({
        tenantId: e.tenant_id,
        nameEn: e.name_en,
        expiresAt: e.expires_at.toISOString(),
      })),
      refreshedAt: (row?.refreshed_at ?? new Date()).toISOString(),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const PENDING_CR = ['draft', 'submitted', 'under_review', 'changes_requested'];

interface TribeStatsRow {
  total_persons: bigint;
  living_persons: bigint;
  deceased_persons: bigint;
  male_persons: bigint;
  female_persons: bigint;
  refreshed_at: Date;
}

/**
 * Stats read via the owner/platform client with EXPLICIT tenant filters
 * (materialized views carry no RLS). Person aggregates come from the hourly
 * matviews; fast-changing counts are computed live.
 */
@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Refresh both materialized views (BullMQ hourly + on-demand admin trigger). */
  async refreshViews(): Promise<void> {
    await this.prisma.platform.$executeRawUnsafe('REFRESH MATERIALIZED VIEW tribe_stats_mv');
    await this.prisma.platform.$executeRawUnsafe('REFRESH MATERIALIZED VIEW platform_dashboard_mv');
  }

  tribeStatsRow(tenantId: string): Promise<TribeStatsRow[]> {
    return this.prisma.platform.$queryRaw<TribeStatsRow[]>`
      SELECT total_persons, living_persons, deceased_persons, male_persons, female_persons, refreshed_at
      FROM tribe_stats_mv WHERE tenant_id = ${tenantId}::uuid
    `;
  }

  unitsCount(tenantId: string): Promise<number> {
    return this.prisma.platform.tribalUnit.count({ where: { tenantId } });
  }

  pendingChangeRequests(tenantId: string): Promise<number> {
    return this.prisma.platform.changeRequest.count({
      where: { tenantId, status: { in: PENDING_CR as never } },
    });
  }

  contributorsCount(tenantId: string): Promise<number> {
    return this.prisma.platform.contributorReputation.count({ where: { tenantId } });
  }

  /** Per-person generation depth (max chain to a root) grouped into a histogram. */
  async byGeneration(tenantId: string): Promise<Array<{ depth: number; count: number }>> {
    const rows = await this.prisma.platform.$queryRaw<Array<{ depth: number; count: bigint }>>`
      SELECT gen AS depth, count(*)::bigint AS count
      FROM (
        SELECT c.descendant_id, MAX(c.depth) AS gen
        FROM person_closures c
        JOIN persons p ON p.id = c.descendant_id AND p.deleted_at IS NULL
        WHERE c.tenant_id = ${tenantId}::uuid
        GROUP BY c.descendant_id
      ) t
      GROUP BY gen ORDER BY gen
    `;
    return rows.map((r) => ({ depth: Number(r.depth), count: Number(r.count) }));
  }

  platformDashboardRow(): Promise<
    Array<{
      tribes: bigint;
      active_tribes: bigint;
      suspended_tribes: bigint;
      total_persons: bigint;
      total_users: bigint;
      refreshed_at: Date;
    }>
  > {
    return this.prisma.platform.$queryRaw`SELECT * FROM platform_dashboard_mv LIMIT 1`;
  }

  byPlan(): Promise<Array<{ tier: string; count: bigint }>> {
    return this.prisma.platform.$queryRaw`
      SELECT COALESCE(s.tier::text, 'free') AS tier, count(*)::bigint AS count
      FROM tenants t
      LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id
      GROUP BY 1 ORDER BY 1
    `;
  }

  expiringSoon(): Promise<Array<{ tenant_id: string; name_en: string; expires_at: Date }>> {
    return this.prisma.platform.$queryRaw`
      SELECT t.id AS tenant_id, t.name_en, s.expires_at
      FROM tenant_subscriptions s
      JOIN tenants t ON t.id = s.tenant_id
      WHERE s.expires_at IS NOT NULL
        AND s.expires_at BETWEEN now() AND now() + interval '30 days'
      ORDER BY s.expires_at ASC
    `;
  }
}

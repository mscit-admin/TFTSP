import { Injectable } from '@nestjs/common';
import { ContributorReputation, Prisma, ReputationThresholds } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

const PENDING_STATUSES = ['draft', 'submitted', 'under_review', 'changes_requested'] as const;

/** Tenant-scoped (RLS). */
@Injectable()
export class ReputationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getOrCreateReputation(userId: string): Promise<ContributorReputation> {
    const tenantId = this.tenantContext.requireTenantId();
    const existing = await this.prisma.tenant.contributorReputation.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    return (
      existing ?? this.prisma.tenant.contributorReputation.create({ data: { tenantId, userId } })
    );
  }

  updateReputation(
    userId: string,
    data: Prisma.ContributorReputationUncheckedUpdateInput,
  ): Promise<ContributorReputation> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.tenant.contributorReputation.update({
      where: { tenantId_userId: { tenantId, userId } },
      data,
    });
  }

  listRanked(): Promise<ContributorReputation[]> {
    return this.prisma.tenant.contributorReputation.findMany({
      orderBy: [{ accuracyRate: 'desc' }, { accepted: 'desc' }],
    });
  }

  async getOrCreateThresholds(): Promise<ReputationThresholds> {
    const tenantId = this.tenantContext.requireTenantId();
    const existing = await this.prisma.tenant.reputationThresholds.findUnique({
      where: { tenantId },
    });
    return existing ?? this.prisma.tenant.reputationThresholds.create({ data: { tenantId } });
  }

  updateThresholds(
    data: Prisma.ReputationThresholdsUncheckedUpdateInput,
  ): Promise<ReputationThresholds> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.tenant.reputationThresholds.upsert({
      where: { tenantId },
      create: { tenantId, ...data } as Prisma.ReputationThresholdsUncheckedCreateInput,
      update: data,
    });
  }

  /** Pending contributions (contributionType set) by a contributor. */
  countPending(userId: string): Promise<number> {
    return this.prisma.tenant.changeRequest.count({
      where: {
        createdBy: userId,
        contributionType: { not: null },
        status: { in: [...PENDING_STATUSES] },
      },
    });
  }

  /** Distinct contributors (for stats). */
  countContributors(): Promise<number> {
    return this.prisma.tenant.contributorReputation.count();
  }
}

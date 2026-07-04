import { Injectable } from '@nestjs/common';
import { ChangeRequest, ChangeRequestReview, Prisma, ReviewDecision, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';
import { M2_REVIEW_ROLES } from '../../common/rbac/permissions';

export type ChangeRequestWithReviews = ChangeRequest & { reviews: ChangeRequestReview[] };

@Injectable()
export class ChangeRequestRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  create(data: Omit<Prisma.ChangeRequestUncheckedCreateInput, 'tenantId'>): Promise<ChangeRequest> {
    return this.prisma.tenant.changeRequest.create({
      data: { ...data, tenantId: this.tenantContext.requireTenantId() },
    });
  }

  findById(id: string): Promise<ChangeRequestWithReviews | null> {
    return this.prisma.tenant.changeRequest.findUnique({
      where: { id },
      include: { reviews: { orderBy: { createdAt: 'asc' } } },
    });
  }

  list(
    where: Prisma.ChangeRequestWhereInput,
    skip: number,
    take: number,
  ): Promise<ChangeRequestWithReviews[]> {
    return this.prisma.tenant.changeRequest.findMany({
      where,
      include: { reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(where: Prisma.ChangeRequestWhereInput): Promise<number> {
    return this.prisma.tenant.changeRequest.count({ where });
  }

  updateStatus(id: string, data: Prisma.ChangeRequestUpdateInput): Promise<ChangeRequest> {
    return this.prisma.tenant.changeRequest.update({ where: { id }, data });
  }

  updateTx(
    tx: TenantTransactionClient,
    id: string,
    data: Prisma.ChangeRequestUncheckedUpdateInput,
  ): Promise<ChangeRequest> {
    return tx.changeRequest.update({ where: { id }, data });
  }

  /** Insert or update this reviewer's decision (each reviewer counts once). */
  upsertReview(
    changeRequestId: string,
    reviewerId: string,
    decision: ReviewDecision,
    comment: string | null,
  ): Promise<ChangeRequestReview> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.tenant.changeRequestReview.upsert({
      where: { changeRequestId_reviewerId: { changeRequestId, reviewerId } },
      create: { tenantId, changeRequestId, reviewerId, decision, comment },
      update: { decision, comment },
    });
  }

  /** Distinct approvals = number of review rows with decision 'approve'. */
  approvalsCount(changeRequestId: string): Promise<number> {
    return this.prisma.tenant.changeRequestReview.count({
      where: { changeRequestId, decision: ReviewDecision.approve },
    });
  }

  /**
   * Users who can review in this tenant (role_assignments is authorization
   * metadata, read via the platform client with explicit tenantId — D-101).
   */
  async reviewerIds(tenantId: string): Promise<string[]> {
    const now = new Date();
    const rows = await this.prisma.platform.roleAssignment.findMany({
      where: {
        tenantId,
        role: { in: M2_REVIEW_ROLES as Role[] },
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }
}

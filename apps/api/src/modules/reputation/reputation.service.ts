import { Injectable } from '@nestjs/common';
import { ContributorReputation, ReputationThresholds, TrustLevel } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ReputationRepository } from './reputation.repository';
import { UpdateReputationThresholdsDto } from './dto/reputation.dto';

@Injectable()
export class ReputationService {
  constructor(
    private readonly repo: ReputationRepository,
    private readonly audit: AuditService,
  ) {}

  me(userId: string): Promise<ContributorReputation> {
    return this.repo.getOrCreateReputation(userId);
  }

  listRanked(): Promise<ContributorReputation[]> {
    return this.repo.listRanked();
  }

  getThresholds(): Promise<ReputationThresholds> {
    return this.repo.getOrCreateThresholds();
  }

  async updateThresholds(dto: UpdateReputationThresholdsDto): Promise<ReputationThresholds> {
    const before = await this.repo.getOrCreateThresholds();
    const updated = await this.repo.updateThresholds({ ...dto });
    await this.audit.record({
      action: 'reputation.thresholds.update',
      entityType: 'ReputationThresholds',
      entityId: updated.tenantId,
      before,
      after: updated,
    });
    return updated;
  }

  countPending(userId: string): Promise<number> {
    return this.repo.countPending(userId);
  }

  /**
   * Update a contributor's counters after a review decision (Spec §13.3):
   * bump accepted/rejected + total, recompute `accuracyRate` immediately, and
   * re-derive `trustLevel`. NO automatic privilege promotion (v1).
   */
  async recordDecision(userId: string, accepted: boolean): Promise<ContributorReputation> {
    const rep = await this.repo.getOrCreateReputation(userId);
    const thresholds = await this.repo.getOrCreateThresholds();

    const acceptedCount = rep.accepted + (accepted ? 1 : 0);
    const rejectedCount = rep.rejected + (accepted ? 0 : 1);
    const total = rep.totalContributions + 1;
    const accuracyRate = acceptedCount / Math.max(1, acceptedCount + rejectedCount);
    const trustLevel = this.deriveTrust(acceptedCount, accuracyRate, thresholds);

    return this.repo.updateReputation(userId, {
      totalContributions: total,
      accepted: acceptedCount,
      rejected: rejectedCount,
      accuracyRate,
      trustLevel,
    });
  }

  private deriveTrust(accepted: number, accuracy: number, t: ReputationThresholds): TrustLevel {
    if (accepted >= t.goldMinAccepted && accuracy >= t.goldMinAccuracy) {
      return TrustLevel.gold;
    }
    if (accepted >= t.silverMinAccepted && accuracy >= t.silverMinAccuracy) {
      return TrustLevel.silver;
    }
    return TrustLevel.bronze;
  }
}

import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  ChangeOperation,
  ChangeRequest,
  ChangeRequestStatus,
  ChangeTargetType,
  NotificationType,
  Prisma,
  ReviewDecision,
} from '@prisma/client';
import { IMPORT_BATCH_APPLIER } from '../imports/import.constants';
import type { ImportBatchApplier } from '../imports/import-apply.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { assertValidPatch } from '../../common/util/json-patch';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { WorkflowSettingsService } from '../workflow-settings/workflow-settings.service';
import { ChangeRequestRepository, ChangeRequestWithReviews } from './change-request.repository';
import { ChangeRequestPublisher } from './change-request.publisher';
import {
  CreateChangeRequestDto,
  ListChangeRequestsDto,
  ReviewChangeRequestDto,
  UpdateChangeRequestDto,
} from './dto/change-request.dto';

const ACTIVE_STATUSES: ChangeRequestStatus[] = [
  ChangeRequestStatus.submitted,
  ChangeRequestStatus.under_review,
];

@Injectable()
export class ChangeRequestService {
  constructor(
    private readonly repo: ChangeRequestRepository,
    private readonly publisher: ChangeRequestPublisher,
    private readonly settings: WorkflowSettingsService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    // M2.5: optional so the M2 module stays independent of the imports module.
    @Optional()
    @Inject(IMPORT_BATCH_APPLIER)
    private readonly importApplier?: ImportBatchApplier,
  ) {}

  async create(dto: CreateChangeRequestDto, user: AuthenticatedUser): Promise<ChangeRequest> {
    assertValidPatch(dto.patch);

    if (dto.operation !== ChangeOperation.create && !dto.targetId) {
      throw AppException.badRequest(ErrorKeys.CR_TARGET_REQUIRED);
    }

    let baseVersion: number | null = null;
    if (dto.operation !== ChangeOperation.create && dto.targetId) {
      baseVersion = await this.captureBaseVersion(dto.targetType, dto.targetId);
    }

    const settings = await this.settings.get();
    const expiresAt = new Date(Date.now() + settings.expiryDays * 86_400_000);

    const cr = await this.repo.create({
      targetType: dto.targetType,
      targetId: dto.targetId ?? null,
      operation: dto.operation,
      patch: dto.patch as unknown as Prisma.InputJsonValue,
      status: ChangeRequestStatus.draft,
      baseVersion,
      createdBy: user.id,
      expiresAt,
    });

    await this.audit.record({
      action: 'changeRequest.create',
      entityType: 'ChangeRequest',
      entityId: cr.id,
      after: cr,
    });
    return cr;
  }

  async findOne(id: string): Promise<ChangeRequestWithReviews> {
    const cr = await this.repo.findById(id);
    if (!cr) {
      throw AppException.notFound(ErrorKeys.CHANGE_REQUEST_NOT_FOUND, { id });
    }
    return cr;
  }

  async list(dto: ListChangeRequestsDto, user: AuthenticatedUser) {
    const where: Prisma.ChangeRequestWhereInput = {};
    if (dto.status) {
      where.status = dto.status as ChangeRequestStatus;
    }
    if (dto.mine) {
      where.createdBy = user.id;
    }
    if (dto.queue) {
      where.status = { in: ACTIVE_STATUSES };
      where.createdBy = { not: user.id };
    }
    const page = Number(dto.page) || 1;
    const pageSize = Number(dto.pageSize) || 20;
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.repo.list(where, skip, pageSize),
      this.repo.count(where),
    ]);
    return { data, page, pageSize, total };
  }

  async update(
    id: string,
    dto: UpdateChangeRequestDto,
    user: AuthenticatedUser,
  ): Promise<ChangeRequest> {
    assertValidPatch(dto.patch);
    const cr = await this.findOne(id);
    const settings = await this.settings.get();

    const isOwner = cr.createdBy === user.id;
    const ownerEditable =
      cr.status === ChangeRequestStatus.draft ||
      cr.status === ChangeRequestStatus.changes_requested;
    const reviewerEditable =
      settings.reviewerCanEdit && ACTIVE_STATUSES.includes(cr.status) && !isOwner;

    if (isOwner && !ownerEditable) {
      throw AppException.badRequest(ErrorKeys.CR_INVALID_STATE, { status: cr.status });
    }
    if (!isOwner && !reviewerEditable) {
      throw AppException.forbidden(ErrorKeys.CR_NOT_OWNER);
    }

    const updated = await this.repo.updateStatus(id, {
      patch: dto.patch as unknown as Prisma.InputJsonValue,
    });
    await this.audit.record({
      action: 'changeRequest.update',
      entityType: 'ChangeRequest',
      entityId: id,
      before: cr,
      after: updated,
    });
    return updated;
  }

  async submit(id: string, user: AuthenticatedUser): Promise<ChangeRequest> {
    const cr = await this.findOne(id);
    if (cr.createdBy !== user.id) {
      throw AppException.forbidden(ErrorKeys.CR_NOT_OWNER);
    }
    if (
      cr.status !== ChangeRequestStatus.draft &&
      cr.status !== ChangeRequestStatus.changes_requested
    ) {
      throw AppException.badRequest(ErrorKeys.CR_INVALID_STATE, { status: cr.status });
    }

    const updated = await this.repo.updateStatus(id, { status: ChangeRequestStatus.submitted });
    await this.audit.record({
      action: 'changeRequest.submit',
      entityType: 'ChangeRequest',
      entityId: id,
      before: cr,
      after: updated,
    });

    // Notify reviewers (excluding the author).
    const tenantId = this.tenantContext.requireTenantId();
    const reviewerIds = (await this.repo.reviewerIds(tenantId)).filter((rid) => rid !== user.id);
    await this.notifications.notifyMany(
      tenantId,
      reviewerIds,
      NotificationType.change_request_submitted,
      { changeRequestId: id, targetType: cr.targetType, operation: cr.operation },
    );
    return updated;
  }

  async review(
    id: string,
    dto: ReviewChangeRequestDto,
    user: AuthenticatedUser,
  ): Promise<ChangeRequest> {
    const cr = await this.findOne(id);
    if (!ACTIVE_STATUSES.includes(cr.status)) {
      throw AppException.badRequest(ErrorKeys.CR_INVALID_STATE, { status: cr.status });
    }
    if (cr.createdBy === user.id) {
      throw AppException.forbidden(ErrorKeys.CR_CANNOT_REVIEW_OWN);
    }

    await this.repo.upsertReview(id, user.id, dto.decision, dto.comment ?? null);
    await this.audit.record({
      action: 'changeRequest.review',
      entityType: 'ChangeRequest',
      entityId: id,
      after: { decision: dto.decision, reviewerId: user.id },
    });

    if (dto.decision === ReviewDecision.reject) {
      return this.finalizeNonApprove(
        cr,
        ChangeRequestStatus.rejected,
        NotificationType.change_request_rejected,
      );
    }
    if (dto.decision === ReviewDecision.request_changes) {
      return this.finalizeNonApprove(
        cr,
        ChangeRequestStatus.changes_requested,
        NotificationType.change_request_changes_requested,
      );
    }

    // approve
    const approvals = await this.repo.approvalsCount(id);
    const settings = await this.settings.get();
    if (approvals >= settings.approvalsRequired) {
      return this.publish(cr);
    }

    // Not enough approvals yet — move to under_review and wait.
    const updated = await this.repo.updateStatus(id, { status: ChangeRequestStatus.under_review });
    return updated;
  }

  // -------------------------------------------------------------------------

  private async finalizeNonApprove(
    cr: ChangeRequestWithReviews,
    status: ChangeRequestStatus,
    notifyType: NotificationType,
  ): Promise<ChangeRequest> {
    const updated = await this.repo.updateStatus(cr.id, { status });
    // Keep an import batch's status in sync when its CR is rejected (M2.5).
    if (
      status === ChangeRequestStatus.rejected &&
      cr.targetType === ChangeTargetType.import_batch &&
      this.importApplier
    ) {
      await this.importApplier.onBatchRejected(cr);
    }
    await this.notifyOwner(cr, notifyType);
    return updated;
  }

  /** Auto-publish: atomic apply + conflict re-check, then notify the owner. */
  private async publish(cr: ChangeRequestWithReviews): Promise<ChangeRequest> {
    // M2.5: a bulk-import batch is applied in its own chunked transactions
    // (1,000 rows/tx) by the import module — not the single-tx generic path.
    if (cr.targetType === ChangeTargetType.import_batch && this.importApplier) {
      await this.importApplier.publishBatch(cr);
      const updated = await this.repo.updateStatus(cr.id, {
        status: ChangeRequestStatus.published,
        publishedAt: new Date(),
      });
      await this.notifyOwner(cr, NotificationType.change_request_approved);
      await this.notifyOwner(cr, NotificationType.change_request_published);
      await this.audit.record({
        action: 'changeRequest.published',
        entityType: 'ChangeRequest',
        entityId: cr.id,
        before: cr,
        after: updated,
      });
      return updated;
    }

    const { updated, outcome } = await this.prisma.tenantTransaction(async (tx) => {
      const result = await this.publisher.apply(tx, cr);
      const next =
        result.outcome === 'published'
          ? {
              status: ChangeRequestStatus.published,
              publishedAt: new Date(),
              targetId: result.targetId,
            }
          : { status: ChangeRequestStatus.conflict };
      const row = await this.repo.updateTx(tx, cr.id, next);
      return { updated: row, outcome: result.outcome };
    });

    if (outcome === 'published') {
      await this.notifyOwner(cr, NotificationType.change_request_approved);
      await this.notifyOwner(cr, NotificationType.change_request_published);
    } else {
      await this.notifyOwner(cr, NotificationType.change_request_conflict);
    }
    await this.audit.record({
      action: `changeRequest.${outcome}`,
      entityType: 'ChangeRequest',
      entityId: cr.id,
      before: cr,
      after: updated,
    });
    return updated;
  }

  private async notifyOwner(cr: ChangeRequest, type: NotificationType): Promise<void> {
    await this.notifications.notify({
      tenantId: this.tenantContext.requireTenantId(),
      userId: cr.createdBy,
      type,
      payload: { changeRequestId: cr.id, targetType: cr.targetType, operation: cr.operation },
    });
  }

  private async captureBaseVersion(
    targetType: ChangeTargetType,
    targetId: string,
  ): Promise<number | null> {
    if (targetType === ChangeTargetType.person) {
      const person = await this.prisma.tenant.person.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { version: true },
      });
      if (!person) {
        throw AppException.notFound(ErrorKeys.PERSON_NOT_FOUND, { id: targetId });
      }
      return person.version;
    }
    // union / tribal_unit have no version column (existence-based conflict).
    return null;
  }
}

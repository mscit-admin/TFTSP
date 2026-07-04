import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ImportBatch, ImportBatchStatus, ImportRow, ImportRowStatus, Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { MinioService } from '../../common/minio/minio.service';
import { AuditService } from '../audit/audit.service';
import { ChangeRequestService } from '../change-requests/change-request.service';
import { LineageService } from '../lineage/lineage.service';
import { ImportRepository } from './import.repository';
import { ImportDispatcher } from './import.dispatcher';
import { streamUploadToMinio } from './parsing/upload.util';
import { ListImportsDto, ListRowsDto, SubmitImportDto, UpdateImportRowDto } from './dto/import.dto';
import { ROW_ERROR } from './import.constants';
import { ImportRowError } from './import.types';

@Injectable()
export class ImportService {
  constructor(
    private readonly repo: ImportRepository,
    private readonly minio: MinioService,
    private readonly dispatcher: ImportDispatcher,
    private readonly audit: AuditService,
    private readonly lineage: LineageService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    @Inject(forwardRef(() => ChangeRequestService))
    private readonly changeRequests: ChangeRequestService,
  ) {}

  async upload(req: Request, user: AuthenticatedUser): Promise<ImportBatch> {
    const tenantId = this.tenantContext.requireTenantId();
    const batchId = uuidv4();
    const fileKey = `imports/${tenantId}/${batchId}.dat`;

    const { filename, format } = await streamUploadToMinio(req, this.minio, fileKey);

    const batch = await this.repo.createBatch({
      id: batchId,
      tenantId,
      filename,
      fileKey,
      format,
      status: ImportBatchStatus.uploaded,
      progress: 0,
      createdBy: user.id,
    });

    await this.audit.record({
      action: 'import.upload',
      entityType: 'ImportBatch',
      entityId: batch.id,
      after: { filename, format },
    });

    // Hand off to the BullMQ worker (or a no-op when Redis is disabled — tests
    // drive ImportParseService.run directly).
    await this.dispatcher.enqueueParse(batch.id);
    return batch;
  }

  async list(dto: ListImportsDto) {
    const skip = (dto.page - 1) * dto.pageSize;
    const [data, total] = await Promise.all([
      this.repo.listBatches(skip, dto.pageSize),
      this.repo.countBatches(),
    ]);
    return { data, page: dto.page, pageSize: dto.pageSize, total };
  }

  async get(id: string): Promise<ImportBatch> {
    const batch = await this.repo.findBatch(id);
    if (!batch) {
      throw AppException.notFound(ErrorKeys.IMPORT_NOT_FOUND, { id });
    }
    return batch;
  }

  async listRows(id: string, dto: ListRowsDto) {
    await this.get(id);
    const skip = (dto.page - 1) * dto.pageSize;
    const [data, total] = await Promise.all([
      this.repo.listRows(id, dto.status, skip, dto.pageSize),
      this.repo.countRows(id, dto.status),
    ]);
    return { data, page: dto.page, pageSize: dto.pageSize, total };
  }

  async updateRow(id: string, rowId: string, dto: UpdateImportRowDto): Promise<ImportRow> {
    const batch = await this.get(id);
    if (batch.status !== ImportBatchStatus.preview) {
      throw AppException.badRequest(ErrorKeys.IMPORT_INVALID_STATE, { status: batch.status });
    }
    const row = await this.repo.findRow(id, rowId);
    if (!row) {
      throw AppException.notFound(ErrorKeys.IMPORT_ROW_NOT_FOUND, { rowId });
    }

    const data: Prisma.ImportRowUncheckedUpdateInput = {};
    if (dto.decision !== undefined) data.decision = dto.decision;
    if (dto.mergeTargetId !== undefined) data.mergeTargetId = dto.mergeTargetId;

    // Resolving an ambiguous reference clears the corresponding error + re-derives status.
    let errors = row.errors as unknown as ImportRowError[];
    if (dto.resolvedFatherId !== undefined) {
      data.resolvedFatherId = dto.resolvedFatherId;
      errors = errors.filter(
        (e) => !(e.column === 'fatherRef' && e.messageKey === ROW_ERROR.AMBIGUOUS_REF),
      );
    }
    if (dto.resolvedMotherId !== undefined) {
      data.resolvedMotherId = dto.resolvedMotherId;
      errors = errors.filter(
        (e) => !(e.column === 'motherRef' && e.messageKey === ROW_ERROR.AMBIGUOUS_REF),
      );
    }
    if (dto.resolvedSpouseId !== undefined) {
      data.resolvedSpouseId = dto.resolvedSpouseId;
      errors = errors.filter(
        (e) => !(e.column === 'spouseRef' && e.messageKey === ROW_ERROR.AMBIGUOUS_REF),
      );
    }
    if (errors.length !== (row.errors as unknown as ImportRowError[]).length) {
      data.errors = errors as unknown as Prisma.InputJsonValue;
      data.status = this.deriveStatus(errors, row.duplicateOfId);
    }

    return this.repo.updateRow(rowId, data);
  }

  async submit(id: string, dto: SubmitImportDto, user: AuthenticatedUser): Promise<ImportBatch> {
    const batch = await this.get(id);
    if (batch.status !== ImportBatchStatus.preview) {
      throw AppException.badRequest(ErrorKeys.IMPORT_INVALID_STATE, { status: batch.status });
    }
    const tenantId = this.tenantContext.requireTenantId();

    const errorCount = await this.repo.countRows(id, ImportRowStatus.error);
    const ambiguousCount = await this.repo.countRows(id, ImportRowStatus.ambiguous);
    if (!dto.partial && errorCount + ambiguousCount > 0) {
      throw AppException.badRequest(ErrorKeys.IMPORT_HAS_ERRORS, { errorCount, ambiguousCount });
    }

    // Rows that will CREATE a person (merges do not consume plan quota).
    const creating = await this.countCreating(id);
    if (creating === 0) {
      throw AppException.badRequest(ErrorKeys.IMPORT_NOTHING_TO_IMPORT);
    }

    // Plan-limit guard BEFORE processing (Spec §12 / D-301).
    const [current, max] = await Promise.all([
      this.repo.ownerPersonCount(tenantId),
      this.repo.ownerTenantMaxPersons(tenantId),
    ]);
    if (current + creating > max) {
      throw AppException.badRequest(ErrorKeys.IMPORT_PLAN_LIMIT_EXCEEDED, {
        current,
        max,
        available: Math.max(0, max - current),
        requested: creating,
      });
    }

    // ONE change request into the M2 workflow (never a direct write).
    const cr = await this.changeRequests.create(
      {
        targetType: 'import_batch',
        targetId: id,
        operation: 'create',
        patch: [{ op: 'add', path: '/importBatchId', value: id }],
      },
      user,
    );
    await this.changeRequests.submit(cr.id, user);

    const updated = await this.repo.updateBatch(id, {
      status: ImportBatchStatus.submitted,
      changeRequestId: cr.id,
    });
    await this.audit.record({
      action: 'import.submit',
      entityType: 'ImportBatch',
      entityId: id,
      after: { changeRequestId: cr.id, creating, partial: !!dto.partial },
    });
    return updated;
  }

  async rollback(id: string, _user: AuthenticatedUser): Promise<ImportBatch> {
    const batch = await this.get(id);
    if (batch.status !== ImportBatchStatus.published) {
      throw AppException.badRequest(ErrorKeys.IMPORT_INVALID_STATE, { status: batch.status });
    }
    const tenantId = this.tenantContext.requireTenantId();
    const batchPersonIds = await this.repo.ownerBatchPersonIds(tenantId, id);

    const blockers = await this.findRollbackBlockers(tenantId, id, batchPersonIds);
    if (blockers.dependentChildren.length + blockers.unions.length > 0) {
      throw AppException.conflict(ErrorKeys.IMPORT_ROLLBACK_BLOCKED, blockers);
    }

    // Soft-delete the batch's created records, then rebuild the closure.
    await this.prisma.tenantTransaction(async (tx) => {
      await tx.person.updateMany({
        where: { importBatchId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    });
    await this.lineage.rebuildClosure();

    const updated = await this.repo.updateBatch(id, { status: ImportBatchStatus.rolled_back });
    await this.audit.record({
      action: 'import_rollback',
      entityType: 'ImportBatch',
      entityId: id,
      before: { count: batchPersonIds.length },
      after: { status: ImportBatchStatus.rolled_back },
    });
    return updated;
  }

  // -------------------------------------------------------------------------

  private deriveStatus(errors: ImportRowError[], duplicateOfId: string | null): ImportRowStatus {
    if (errors.some((e) => e.messageKey === ROW_ERROR.AMBIGUOUS_REF)) {
      return ImportRowStatus.ambiguous;
    }
    if (errors.length > 0) {
      return ImportRowStatus.error;
    }
    return duplicateOfId ? ImportRowStatus.duplicate_candidate : ImportRowStatus.valid;
  }

  /** Count rows that will create a new person on publish (valid/dup with decision new). */
  private async countCreating(batchId: string): Promise<number> {
    const [valid, dup] = await Promise.all([
      this.prisma.tenant.importRow.count({
        where: {
          importBatchId: batchId,
          status: ImportRowStatus.valid,
          decision: { not: 'ignore' },
        },
      }),
      this.prisma.tenant.importRow.count({
        where: {
          importBatchId: batchId,
          status: ImportRowStatus.duplicate_candidate,
          decision: 'new',
        },
      }),
    ]);
    return valid + dup;
  }

  private async findRollbackBlockers(
    tenantId: string,
    _batchId: string,
    batchPersonIds: string[],
  ): Promise<{ dependentChildren: string[]; unions: string[] }> {
    if (batchPersonIds.length === 0) {
      return { dependentChildren: [], unions: [] };
    }
    const [children, unions] = await Promise.all([
      // Any live person that is NOT one of the batch's own records but points at
      // one as a parent (children added after import). `notIn` is null-safe.
      this.prisma.platform.person.findMany({
        where: {
          tenantId,
          deletedAt: null,
          id: { notIn: batchPersonIds },
          OR: [{ fatherId: { in: batchPersonIds } }, { motherId: { in: batchPersonIds } }],
        },
        select: { id: true },
      }),
      this.prisma.platform.union.findMany({
        where: {
          tenantId,
          OR: [{ husbandId: { in: batchPersonIds } }, { wifeId: { in: batchPersonIds } }],
        },
        select: { id: true },
      }),
    ]);
    return {
      dependentChildren: children.map((c) => c.id),
      unions: unions.map((u) => u.id),
    };
  }
}

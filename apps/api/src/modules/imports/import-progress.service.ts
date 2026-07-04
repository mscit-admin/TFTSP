import { Injectable } from '@nestjs/common';
import { ImportBatchStatus } from '@prisma/client';
import { ImportRepository } from './import.repository';
import { ImportGateway } from './import.gateway';
import { ImportBatchCounts } from './import.types';

/**
 * Persists batch status/progress/counts (owner client) and emits `import_progress`
 * over the `/imports` socket to the batch owner — during parse/validate/resolve/publish.
 */
@Injectable()
export class ImportProgressService {
  constructor(
    private readonly repo: ImportRepository,
    private readonly gateway: ImportGateway,
  ) {}

  async update(
    batch: { id: string; tenantId: string; createdBy: string },
    status: ImportBatchStatus,
    progress: number,
    counts?: Partial<ImportBatchCounts>,
  ): Promise<void> {
    await this.repo.ownerUpdateBatch(batch.id, {
      status,
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      ...(counts ? { counts: counts as object } : {}),
    });
    this.gateway.emitProgress(batch.tenantId, batch.createdBy, {
      importBatchId: batch.id,
      status,
      progress: Math.round(progress),
      counts: counts as Record<string, number> | undefined,
    });
  }
}

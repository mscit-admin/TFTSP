import { Injectable, Logger } from '@nestjs/common';
import { ChangeRequest, ImportBatch, ImportBatchStatus, ImportRow } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PersonsService } from '../persons/persons.service';
import { CreatePersonDto } from '../persons/dto/create-person.dto';
import { UpdatePersonDto } from '../persons/dto/update-person.dto';
import { buildFullName } from '../../common/util/arabic';
import { ImportRepository } from './import.repository';
import { ImportProgressService } from './import-progress.service';
import { APPLY_CHUNK_SIZE } from './import.constants';
import { EMPTY_COUNTS, ImportBatchCounts, RawRow } from './import.types';

export interface ImportPublishOutcome {
  outcome: 'published';
  batchId: string;
}

/** Contract the M2 change-request service delegates import-batch publish to. */
export interface ImportBatchApplier {
  publishBatch(cr: ChangeRequest): Promise<ImportPublishOutcome>;
  onBatchRejected(cr: ChangeRequest): Promise<void>;
}

/**
 * Applies an approved import batch to the live tree (Spec §12): chunked apply
 * (1,000 rows / transaction), in-file parents created before children, each
 * created record tagged import_batch_id; merges go through the M2 JSON-Patch
 * update path. Runs under the reviewer's tenant context (RLS-scoped).
 */
@Injectable()
export class ImportApplyService implements ImportBatchApplier {
  private readonly logger = new Logger(ImportApplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ImportRepository,
    private readonly persons: PersonsService,
    private readonly audit: AuditService,
    private readonly progress: ImportProgressService,
  ) {}

  async publishBatch(cr: ChangeRequest): Promise<ImportPublishOutcome> {
    const batchId = cr.targetId as string;
    const batch = await this.repo.ownerFindBatch(batchId);
    if (!batch) {
      throw new Error(`Import batch ${batchId} not found on publish`);
    }
    const rows = await this.repo.ownerListRows(batchId);
    const ordered = this.topologicalOrder(rows);
    const unitByName = await this.buildUnitMap(batch.tenantId);

    const refToPersonId = new Map<string, string>();
    const counts: ImportBatchCounts = { ...EMPTY_COUNTS, ...(batch.counts as object) };
    counts.created = 0;
    counts.merged = 0;
    counts.ignored = 0;

    const ref = { id: batch.id, tenantId: batch.tenantId, createdBy: batch.createdBy };

    for (let i = 0; i < ordered.length; i += APPLY_CHUNK_SIZE) {
      const chunk = ordered.slice(i, i + APPLY_CHUNK_SIZE);
      await this.prisma.tenantTransaction(async (tx) => {
        for (const row of chunk) {
          await this.applyRow(tx, batch, row, refToPersonId, unitByName, counts);
        }
      });
      const pct = 100 * Math.min(1, (i + chunk.length) / Math.max(1, ordered.length));
      await this.progress.update(ref, ImportBatchStatus.submitted, pct, counts);
    }

    await this.repo.ownerUpdateBatch(batch.id, {
      status: ImportBatchStatus.published,
      progress: 100,
      counts: counts as object,
    });
    await this.progress.update(ref, ImportBatchStatus.published, 100, counts);

    await this.audit.record({
      action: 'import.publish',
      entityType: 'ImportBatch',
      entityId: batch.id,
      after: { filename: batch.filename, counts },
    });
    this.logger.log(
      `Import ${batch.id} published: ${counts.created} created, ${counts.merged} merged, ${counts.ignored} ignored.`,
    );
    return { outcome: 'published', batchId: batch.id };
  }

  async onBatchRejected(cr: ChangeRequest): Promise<void> {
    if (!cr.targetId) {
      return;
    }
    const batch = await this.repo.ownerFindBatch(cr.targetId);
    if (batch && batch.status === ImportBatchStatus.submitted) {
      await this.repo.ownerUpdateBatch(batch.id, { status: ImportBatchStatus.rejected });
    }
  }

  // -------------------------------------------------------------------------

  private async applyRow(
    tx: Parameters<Parameters<PrismaService['tenantTransaction']>[0]>[0],
    batch: ImportBatch,
    row: ImportRow,
    refToPersonId: Map<string, string>,
    unitByName: Map<string, string>,
    counts: ImportBatchCounts,
  ): Promise<void> {
    const appliable =
      row.decision !== 'ignore' && (row.status === 'valid' || row.status === 'duplicate_candidate');
    if (!appliable) {
      counts.ignored += 1;
      return;
    }

    const raw = row.raw as unknown as RawRow;
    const fatherId = this.resolveParentId(raw.fatherRef, row.resolvedFatherId, refToPersonId);
    const motherId = this.resolveParentId(raw.motherRef, row.resolvedMotherId, refToPersonId);

    if (row.decision === 'merge') {
      const targetId = row.mergeTargetId ?? row.duplicateOfId;
      if (targetId) {
        await this.mergeInto(tx, targetId, raw, fatherId, motherId, unitByName);
        counts.merged += 1;
        refToPersonId.set(row.rowRef, targetId);
        return;
      }
      // No merge target — fall through to create.
    }

    const dto = this.rowToCreateDto(raw, fatherId, motherId, unitByName);
    const person = await this.persons.createInTx(tx, dto, batch.createdBy, batch.id);
    counts.created += 1;
    refToPersonId.set(row.rowRef, person.id);
    await this.repo.ownerUpdateRow(row.id, { createdPersonId: person.id });
  }

  private async mergeInto(
    tx: Parameters<Parameters<PrismaService['tenantTransaction']>[0]>[0],
    targetId: string,
    raw: RawRow,
    fatherId: string | null,
    motherId: string | null,
    unitByName: Map<string, string>,
  ): Promise<void> {
    const current = await tx.person.findFirst({ where: { id: targetId, deletedAt: null } });
    if (!current) {
      return;
    }
    // Same JSON-Patch semantics as M2: only set the fields the row provides.
    const dto: UpdatePersonDto = { version: current.version };
    const parts = this.splitName(raw.fullName);
    if (raw.fullName) {
      Object.assign(dto, parts);
    }
    if (raw.laqab) dto.laqab = raw.laqab;
    if (raw.profession) dto.profession = raw.profession;
    if (raw.birthDate) dto.birthDate = raw.birthDate;
    if (raw.deathDate) dto.deathDate = raw.deathDate;
    if (fatherId) dto.fatherId = fatherId;
    if (motherId) dto.motherId = motherId;
    const unitId = this.resolveUnit(raw, unitByName);
    if (unitId) dto.tribalUnitId = unitId;
    await this.persons.updateInTx(tx, targetId, dto);
  }

  private rowToCreateDto(
    raw: RawRow,
    fatherId: string | null,
    motherId: string | null,
    unitByName: Map<string, string>,
  ): CreatePersonDto {
    const parts = this.splitName(raw.fullName);
    return {
      firstName: parts.firstName,
      fatherName: parts.fatherName,
      grandfatherName: parts.grandfatherName,
      familyName: parts.familyName,
      laqab: raw.laqab ?? undefined,
      gender: raw.gender === 'female' || raw.gender === 'أنثى' ? 'female' : 'male',
      birthDate: raw.birthDate ?? undefined,
      deathDate: raw.deathDate ?? undefined,
      profession: raw.profession ?? undefined,
      fatherId: fatherId ?? undefined,
      motherId: motherId ?? undefined,
      tribalUnitId: this.resolveUnit(raw, unitByName) ?? undefined,
      confirmDuplicate: true,
    };
  }

  private resolveParentId(
    refValue: string | null,
    resolvedId: string | null,
    refToPersonId: Map<string, string>,
  ): string | null {
    if (refValue) {
      const m = /^ref:(.+)$/.exec(refValue.trim());
      if (m) {
        return refToPersonId.get(m[1].trim()) ?? null;
      }
    }
    return resolvedId ?? null;
  }

  private resolveUnit(raw: RawRow, unitByName: Map<string, string>): string | null {
    for (const name of [raw.family, raw.clan, raw.branch]) {
      if (name && unitByName.has(name)) {
        return unitByName.get(name) as string;
      }
    }
    return null;
  }

  private splitName(fullName: string | null): {
    firstName: string;
    fatherName?: string;
    grandfatherName?: string;
    familyName?: string;
  } {
    const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
    const result = {
      firstName: parts[0] ?? ((fullName ?? '').trim() || '—'),
      fatherName: parts[1],
      grandfatherName: parts[2],
      familyName: parts.slice(3).join(' ') || undefined,
    };
    // keep buildFullName consistent (defensive; not persisted here)
    void buildFullName(result);
    return result;
  }

  private async buildUnitMap(tenantId: string): Promise<Map<string, string>> {
    const units = await this.prisma.platform.tribalUnit.findMany({
      where: { tenantId },
      select: { id: true, nameAr: true, nameEn: true },
    });
    const map = new Map<string, string>();
    for (const u of units) {
      map.set(u.nameAr, u.id);
      map.set(u.nameEn, u.id);
    }
    return map;
  }

  /** Kahn topological sort so in-file parents are created before their children. */
  private topologicalOrder(rows: ImportRow[]): ImportRow[] {
    const byRef = new Map(rows.map((r) => [r.rowRef, r]));
    const indegree = new Map<string, number>();
    const children = new Map<string, string[]>();
    rows.forEach((r) => indegree.set(r.rowRef, 0));

    const parentRefs = (r: ImportRow): string[] => {
      const raw = r.raw as unknown as RawRow;
      const refs: string[] = [];
      for (const v of [raw.fatherRef, raw.motherRef]) {
        const m = v ? /^ref:(.+)$/.exec(v.trim()) : null;
        if (m && byRef.has(m[1].trim())) {
          refs.push(m[1].trim());
        }
      }
      return refs;
    };

    for (const r of rows) {
      for (const p of parentRefs(r)) {
        indegree.set(r.rowRef, (indegree.get(r.rowRef) ?? 0) + 1);
        children.set(p, [...(children.get(p) ?? []), r.rowRef]);
      }
    }

    const queue = rows.filter((r) => (indegree.get(r.rowRef) ?? 0) === 0).map((r) => r.rowRef);
    const ordered: ImportRow[] = [];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const ref = queue.shift() as string;
      if (seen.has(ref)) {
        continue;
      }
      seen.add(ref);
      const row = byRef.get(ref);
      if (row) {
        ordered.push(row);
      }
      for (const child of children.get(ref) ?? []) {
        indegree.set(child, (indegree.get(child) ?? 1) - 1);
        if ((indegree.get(child) ?? 0) === 0) {
          queue.push(child);
        }
      }
    }
    // Append any rows left out by residual cycles (they are error rows, skipped on apply).
    for (const r of rows) {
      if (!seen.has(r.rowRef)) {
        ordered.push(r);
      }
    }
    return ordered;
  }
}

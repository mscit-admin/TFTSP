import { Injectable, Logger } from '@nestjs/common';
import { Gender, ImportBatch, ImportBatchStatus, ImportRowStatus, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeArabic, normalizedSql } from '../../common/util/arabic';
import { parsePartialDate } from '../../common/util/dates';
import { MinioService } from '../../common/minio/minio.service';
import { ImportRepository } from './import.repository';
import { ImportProgressService } from './import-progress.service';
import { readCsv, readXlsx } from './parsing/import-file-reader';
import { DUPLICATE_THRESHOLD, ROW_ERROR } from './import.constants';
import { EMPTY_COUNTS, ImportBatchCounts, ImportRowError, RawRow } from './import.types';

interface RowWork {
  id: string;
  rowNumber: number;
  rowRef: string;
  raw: RawRow;
  errors: ImportRowError[];
  gender?: Gender;
  clan: string | null;
  fatherInFileRef?: string;
  motherInFileRef?: string;
  spouseInFileRef?: string;
  resolvedFatherId?: string | null;
  resolvedMotherId?: string | null;
  resolvedSpouseId?: string | null;
  duplicateOfId?: string | null;
  similarity?: number | null;
  ambiguous?: boolean;
}

/**
 * Bulk-import parse pipeline (Spec §12) — Redis-free so it is callable directly
 * (worker + tests). Steps: stream-parse + per-row validation → persist rows →
 * two-pass ref resolution → per-row duplicate check → whole-batch lineage
 * integrity → preview. Uses the owner client (no tenant context in the worker),
 * always filtering by tenant_id.
 */
@Injectable()
export class ImportParseService {
  private readonly logger = new Logger(ImportParseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly repo: ImportRepository,
    private readonly progress: ImportProgressService,
  ) {}

  async run(batchId: string): Promise<ImportBatch> {
    const batch = await this.repo.ownerFindBatch(batchId);
    if (!batch) {
      throw new Error(`Import batch ${batchId} not found`);
    }
    const ref = { id: batch.id, tenantId: batch.tenantId, createdBy: batch.createdBy };
    try {
      await this.progress.update(ref, ImportBatchStatus.parsing, 5);

      const works = await this.parseAndValidate(batch);
      await this.progress.update(ref, ImportBatchStatus.validating, 40, this.counts(works));

      const byRef = new Map(works.map((w) => [w.rowRef, w]));
      this.resolveInFile(works, byRef);
      await this.resolveAgainstDb(batch.tenantId, works);
      await this.progress.update(ref, ImportBatchStatus.resolving, 65, this.counts(works));

      await this.duplicateCheck(batch.tenantId, works);
      this.checkBatchLineage(works, byRef);
      await this.progress.update(ref, ImportBatchStatus.resolving, 85, this.counts(works));

      await this.persistRows(batch, works);

      const counts = this.counts(works);
      await this.repo.ownerUpdateBatch(batch.id, { counts: counts as object });
      await this.progress.update(ref, ImportBatchStatus.preview, 100, counts);
      return (await this.repo.ownerFindBatch(batchId)) as ImportBatch;
    } catch (err) {
      this.logger.error(`Import parse failed for ${batchId}: ${String(err)}`);
      await this.repo.ownerUpdateBatch(batch.id, {
        status: ImportBatchStatus.failed,
        error: String(err),
      });
      await this.progress.update(ref, ImportBatchStatus.failed, 100);
      throw err;
    }
  }

  // ---- step 1: stream-parse + per-row validation ---------------------------

  private async parseAndValidate(batch: ImportBatch): Promise<RowWork[]> {
    const stream = await this.minio.getStream(batch.fileKey);
    const rows = batch.format === 'xlsx' ? readXlsx(stream) : readCsv(stream);

    const works: RowWork[] = [];
    for await (const parsed of rows) {
      const raw = parsed.cells;
      const errors: ImportRowError[] = [];

      const rowRef = raw.rowRef ?? `auto:${parsed.rowNumber}`;
      if (!raw.rowRef) {
        errors.push({ column: 'rowRef', messageKey: ROW_ERROR.ROW_REF_REQUIRED });
      }
      if (!raw.fullName) {
        errors.push({ column: 'fullName', messageKey: ROW_ERROR.FULL_NAME_REQUIRED });
      }
      const gender = this.parseGender(raw.gender);
      if (raw.gender && !gender) {
        errors.push({ column: 'gender', messageKey: ROW_ERROR.INVALID_GENDER });
      }
      for (const [col, value] of [
        ['birthDate', raw.birthDate],
        ['deathDate', raw.deathDate],
      ] as const) {
        if (value) {
          try {
            parsePartialDate(value);
          } catch {
            errors.push({ column: col, messageKey: ROW_ERROR.INVALID_DATE });
          }
        }
      }

      works.push({
        id: uuidv4(),
        rowNumber: parsed.rowNumber,
        rowRef,
        raw,
        errors,
        gender: gender ?? undefined,
        clan: raw.clan,
      });
    }
    return works;
  }

  // ---- step 2: reference resolution ---------------------------------------

  /** Pass 1 — resolve `ref:<rowRef>` links inside the file. */
  private resolveInFile(works: RowWork[], byRef: Map<string, RowWork>): void {
    for (const w of works) {
      w.fatherInFileRef = this.inFileTarget(w.raw.fatherRef, byRef, w, 'fatherRef');
      w.motherInFileRef = this.inFileTarget(w.raw.motherRef, byRef, w, 'motherRef');
      w.spouseInFileRef = this.inFileTarget(w.raw.spouseRef, byRef, w, 'spouseRef');
    }
  }

  private inFileTarget(
    value: string | null,
    byRef: Map<string, RowWork>,
    w: RowWork,
    column: string,
  ): string | undefined {
    if (!value) {
      return undefined;
    }
    const match = /^ref:(.+)$/.exec(value.trim());
    if (!match) {
      return undefined; // a plain name — resolved against the DB in pass 2
    }
    const targetRef = match[1].trim();
    if (!byRef.has(targetRef)) {
      w.errors.push({
        column,
        messageKey:
          column === 'motherRef' ? ROW_ERROR.MOTHER_NOT_FOUND : ROW_ERROR.FATHER_NOT_FOUND,
      });
      return undefined;
    }
    return targetRef;
  }

  /** Pass 2 — resolve plain-name references against the DB (name_normalized + clan). */
  private async resolveAgainstDb(tenantId: string, works: RowWork[]): Promise<void> {
    for (const w of works) {
      if (w.raw.fatherRef && !w.fatherInFileRef && !this.isRef(w.raw.fatherRef)) {
        await this.resolveDbParent(tenantId, w, w.raw.fatherRef, 'father');
      }
      if (w.raw.motherRef && !w.motherInFileRef && !this.isRef(w.raw.motherRef)) {
        await this.resolveDbParent(tenantId, w, w.raw.motherRef, 'mother');
      }
      if (w.raw.spouseRef && !w.spouseInFileRef && !this.isRef(w.raw.spouseRef)) {
        const match = await this.findByName(tenantId, w.raw.spouseRef, w.clan);
        if (match.length === 1) {
          w.resolvedSpouseId = match[0].id;
        } else if (match.length > 1) {
          w.ambiguous = true;
          w.errors.push({ column: 'spouseRef', messageKey: ROW_ERROR.AMBIGUOUS_REF });
        }
      }
    }
  }

  private async resolveDbParent(
    tenantId: string,
    w: RowWork,
    refValue: string,
    kind: 'father' | 'mother',
  ): Promise<void> {
    const matches = await this.findByName(tenantId, refValue, w.clan);
    const column = kind === 'father' ? 'fatherRef' : 'motherRef';
    if (matches.length === 0) {
      w.errors.push({
        column,
        messageKey: kind === 'father' ? ROW_ERROR.FATHER_NOT_FOUND : ROW_ERROR.MOTHER_NOT_FOUND,
      });
      return;
    }
    if (matches.length > 1) {
      w.ambiguous = true;
      w.errors.push({ column, messageKey: ROW_ERROR.AMBIGUOUS_REF });
      return;
    }
    const person = matches[0];
    if (kind === 'father') {
      if (person.gender !== Gender.male) {
        w.errors.push({ column, messageKey: ROW_ERROR.FATHER_MUST_BE_MALE });
      }
      w.resolvedFatherId = person.id;
    } else {
      if (person.gender !== Gender.female) {
        w.errors.push({ column, messageKey: ROW_ERROR.MOTHER_MUST_BE_FEMALE });
      }
      w.resolvedMotherId = person.id;
    }
  }

  // ---- step 3: per-row duplicate check (§8 engine, threshold 0.6) ----------

  private async duplicateCheck(tenantId: string, works: RowWork[]): Promise<void> {
    for (const w of works) {
      if (w.errors.length > 0 || !w.raw.fullName) {
        continue;
      }
      const candidates = await this.similarPersons(tenantId, w.raw.fullName, w.clan);
      if (candidates.length > 0) {
        w.duplicateOfId = candidates[0].id;
        w.similarity = candidates[0].score;
      }
    }
  }

  // ---- step 4: whole-batch lineage integrity (cycles) ----------------------

  private checkBatchLineage(works: RowWork[], byRef: Map<string, RowWork>): void {
    // DFS 3-colour cycle detection over in-file parent edges (father + mother).
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;
    const colour = new Map<string, number>();
    works.forEach((w) => colour.set(w.rowRef, WHITE));
    const inCycle = new Set<string>();

    const visit = (node: RowWork, path: string[]): void => {
      colour.set(node.rowRef, GREY);
      path.push(node.rowRef);
      for (const ref of [node.fatherInFileRef, node.motherInFileRef]) {
        const parent = ref ? byRef.get(ref) : undefined;
        if (!parent) {
          continue;
        }
        const c = colour.get(parent.rowRef);
        if (c === GREY) {
          // Back-edge: everything from parent to current node is on the cycle.
          const idx = path.indexOf(parent.rowRef);
          path.slice(idx).forEach((ref2) => inCycle.add(ref2));
        } else if (c === WHITE) {
          visit(parent, path);
        }
      }
      path.pop();
      colour.set(node.rowRef, BLACK);
    };

    for (const w of works) {
      if (colour.get(w.rowRef) === WHITE) {
        visit(w, []);
      }
    }
    for (const w of works) {
      if (inCycle.has(w.rowRef)) {
        w.errors.push({ column: 'fatherRef', messageKey: ROW_ERROR.CYCLE });
      }
    }
  }

  // ---- step 5: persist rows -----------------------------------------------

  private async persistRows(batch: ImportBatch, works: RowWork[]): Promise<void> {
    const data: Prisma.ImportRowUncheckedCreateInput[] = works.map((w) => ({
      id: w.id,
      tenantId: batch.tenantId,
      importBatchId: batch.id,
      rowRef: w.rowRef,
      rowNumber: w.rowNumber,
      raw: w.raw as unknown as Prisma.InputJsonValue,
      status: this.rowStatus(w),
      errors: w.errors as unknown as Prisma.InputJsonValue,
      resolvedFatherId: w.resolvedFatherId ?? null,
      resolvedMotherId: w.resolvedMotherId ?? null,
      resolvedSpouseId: w.resolvedSpouseId ?? null,
      duplicateOfId: w.duplicateOfId ?? null,
      similarity: w.similarity ?? null,
      decision: w.duplicateOfId ? 'new' : 'new',
    }));
    // Insert in chunks so a 100k-row batch never buffers one giant statement.
    for (let i = 0; i < data.length; i += 1000) {
      await this.repo.ownerInsertRows(data.slice(i, i + 1000));
    }
  }

  // ---- helpers -------------------------------------------------------------

  private rowStatus(w: RowWork): ImportRowStatus {
    if (w.errors.some((e) => e.messageKey === ROW_ERROR.AMBIGUOUS_REF)) {
      return ImportRowStatus.ambiguous;
    }
    if (w.errors.length > 0) {
      return ImportRowStatus.error;
    }
    if (w.duplicateOfId) {
      return ImportRowStatus.duplicate_candidate;
    }
    return ImportRowStatus.valid;
  }

  private counts(works: RowWork[]): ImportBatchCounts {
    const c: ImportBatchCounts = { ...EMPTY_COUNTS, total: works.length };
    for (const w of works) {
      const s = this.rowStatus(w);
      if (s === ImportRowStatus.valid) c.valid += 1;
      else if (s === ImportRowStatus.error) c.error += 1;
      else if (s === ImportRowStatus.duplicate_candidate) c.duplicateCandidate += 1;
      else if (s === ImportRowStatus.ambiguous) c.ambiguous += 1;
    }
    return c;
  }

  private isRef(value: string | null): boolean {
    return !!value && /^ref:/.test(value.trim());
  }

  private parseGender(value: string | null): Gender | undefined {
    if (!value) {
      return undefined;
    }
    const v = value.trim().toLowerCase();
    if (v === 'male' || v === 'm' || v === 'ذكر') {
      return Gender.male;
    }
    if (v === 'female' || v === 'f' || v === 'أنثى' || v === 'انثى') {
      return Gender.female;
    }
    return undefined;
  }

  private async findByName(
    tenantId: string,
    name: string,
    clan: string | null,
  ): Promise<Array<{ id: string; gender: Gender }>> {
    const norm = normalizeArabic(name);
    const clauses: Prisma.Sql[] = [
      Prisma.sql`p.tenant_id = ${tenantId}::uuid`,
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`p.name_normalized = ${norm}`,
    ];
    if (clan) {
      clauses.push(Prisma.sql`(u.name_ar = ${clan} OR u.name_en = ${clan} OR u.id IS NULL)`);
    }
    return this.prisma.platform.$queryRaw<Array<{ id: string; gender: Gender }>>`
      SELECT p.id, p.gender
      FROM persons p
      LEFT JOIN tribal_units u ON u.id = p.tribal_unit_id
      WHERE ${Prisma.join(clauses, ' AND ')}
      LIMIT 5
    `;
  }

  private async similarPersons(
    tenantId: string,
    fullName: string,
    clan: string | null,
  ): Promise<Array<{ id: string; score: number }>> {
    const norm = normalizedSql(fullName);
    const clanClause = clan
      ? Prisma.sql`AND (u.name_ar = ${clan} OR u.name_en = ${clan} OR u.id IS NULL)`
      : Prisma.empty;
    return this.prisma.platform.$queryRaw<Array<{ id: string; score: number }>>`
      SELECT p.id, similarity(p.name_normalized, ${norm}) AS score
      FROM persons p
      LEFT JOIN tribal_units u ON u.id = p.tribal_unit_id
      WHERE p.tenant_id = ${tenantId}::uuid
        AND p.deleted_at IS NULL
        AND similarity(p.name_normalized, ${norm}) >= ${DUPLICATE_THRESHOLD}
        ${clanClause}
      ORDER BY score DESC
      LIMIT 5
    `;
  }
}

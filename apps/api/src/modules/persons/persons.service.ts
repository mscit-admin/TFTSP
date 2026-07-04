import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Gender, Person, Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';
import { buildFullName } from '../../common/util/arabic';
import { parsePartialDate } from '../../common/util/dates';
import { AuditService } from '../audit/audit.service';
import { LineageService } from '../lineage/lineage.service';
import { VisibilityResolver } from '../visibility/visibility.resolver';
import { CreatePersonDto } from './dto/create-person.dto';
import { ListPersonsDto } from './dto/list-persons.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonsRepository } from './persons.repository';

export interface DuplicateCandidate {
  person: Pick<Person, 'id' | 'fullName' | 'fatherName' | 'tribalUnitId'>;
  similarity: number;
}

export interface PaginatedPersons {
  data: Person[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable()
export class PersonsService {
  private readonly duplicateThreshold: number;

  constructor(
    private readonly repo: PersonsRepository,
    private readonly lineage: LineageService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly visibility: VisibilityResolver,
    config: ConfigService,
  ) {
    this.duplicateThreshold = config.get<number>('duplicateSimilarityThreshold') ?? 0.6;
  }

  async list(dto: ListPersonsDto): Promise<PaginatedPersons> {
    const skip = (dto.page - 1) * dto.pageSize;
    const ctx = await this.visibility.buildContext();

    if (dto.q && dto.q.trim().length > 0) {
      const [idRows, total] = await Promise.all([
        this.repo.searchIds(dto.q.trim(), skip, dto.pageSize),
        this.repo.countSearch(dto.q.trim()),
      ]);
      const persons = await this.repo.loadByIds(idRows.map((r) => r.id));
      const byId = new Map(persons.map((p) => [p.id, p]));
      const ordered = idRows.map((r) => byId.get(r.id)).filter((p): p is Person => p !== undefined);
      // EVERY read passes the Visibility Resolver (Spec §3·M3.1).
      return {
        data: this.visibility.filterPersons(ctx, ordered),
        page: dto.page,
        pageSize: dto.pageSize,
        total,
      };
    }

    const where: Prisma.PersonWhereInput = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.repo.findMany(where, skip, dto.pageSize),
      this.repo.count(where),
    ]);
    return {
      data: this.visibility.filterPersons(ctx, data),
      page: dto.page,
      pageSize: dto.pageSize,
      total,
    };
  }

  async findOne(id: string): Promise<Person> {
    const ctx = await this.visibility.buildContext();
    const person = this.visibility.resolveOne(ctx, await this.repo.findById(id));
    if (!person) {
      // 404 (not 403) so existence outside the viewer's scope is not leaked.
      throw AppException.notFound(ErrorKeys.PERSON_NOT_FOUND, { id });
    }
    return person;
  }

  async create(dto: CreatePersonDto): Promise<Person> {
    return this.prisma.tenantTransaction((tx) => this.createInTx(tx, dto));
  }

  /**
   * Create within an existing tenant transaction. Reused by the M1 direct-write
   * path AND the M2 change-request publisher (so lineage/audit stay identical).
   * `createdByOverride` lets the publisher attribute the record to the request author.
   */
  async createInTx(
    tx: TenantTransactionClient,
    dto: CreatePersonDto,
    createdByOverride?: string,
    importBatchId?: string,
  ): Promise<Person> {
    const tenantId = this.tenantContext.requireTenantId();
    const fullName = buildFullName(dto);

    await this.validateParents(tx, dto.fatherId ?? null, dto.motherId ?? null);

    if (!dto.confirmDuplicate) {
      const candidates = await this.findDuplicates(tx, fullName, dto.tribalUnitId ?? null);
      if (candidates.length > 0) {
        throw AppException.conflict(ErrorKeys.DUPLICATE_CANDIDATES, { candidates });
      }
    }

    const person = await this.repo.create(tx, {
      tenantId,
      fullName,
      firstName: dto.firstName,
      fatherName: dto.fatherName ?? null,
      grandfatherName: dto.grandfatherName ?? null,
      familyName: dto.familyName ?? null,
      laqab: dto.laqab ?? null,
      gender: dto.gender,
      birthDate: parsePartialDate(dto.birthDate),
      birthPlace: dto.birthPlace ?? null,
      deathDate: parsePartialDate(dto.deathDate),
      isDeceased: dto.isDeceased ?? false,
      fatherId: dto.fatherId ?? null,
      motherId: dto.motherId ?? null,
      tribalUnitId: dto.tribalUnitId ?? null,
      profession: dto.profession ?? null,
      createdBy: createdByOverride ?? this.tenantContext.userId ?? tenantId,
      importBatchId: importBatchId ?? null,
    });

    await this.lineage.onCreate(tx, person.id, person.fatherId);

    await this.audit.recordTx(tx, {
      action: 'person.create',
      entityType: 'Person',
      entityId: person.id,
      after: person,
    });

    return person;
  }

  async update(id: string, dto: UpdatePersonDto): Promise<Person> {
    return this.prisma.tenantTransaction((tx) => this.updateInTx(tx, id, dto));
  }

  /** Update within an existing tenant transaction (shared by M1 + M2 publisher). */
  async updateInTx(tx: TenantTransactionClient, id: string, dto: UpdatePersonDto): Promise<Person> {
    const before = await tx.person.findFirst({ where: { id, deletedAt: null } });
    if (!before) {
      throw AppException.notFound(ErrorKeys.PERSON_NOT_FOUND, { id });
    }

    const nextFatherId = dto.fatherId !== undefined ? (dto.fatherId ?? null) : before.fatherId;
    const nextMotherId = dto.motherId !== undefined ? (dto.motherId ?? null) : before.motherId;

    // Validate parents only for the ones actually changing.
    await this.validateParents(
      tx,
      dto.fatherId !== undefined ? nextFatherId : null,
      dto.motherId !== undefined ? nextMotherId : null,
    );
    if (dto.motherId !== undefined && nextMotherId === id) {
      throw AppException.badRequest(ErrorKeys.SELF_ANCESTRY, { id });
    }

    // Lineage change (cycle-checked) must happen in this same transaction.
    const fatherChanged = dto.fatherId !== undefined && nextFatherId !== before.fatherId;
    if (fatherChanged) {
      await this.lineage.onFatherChange(tx, id, nextFatherId);
    }

    const data = this.buildUpdateData(before, dto, nextFatherId, nextMotherId);

    const affected = await this.repo.updateWithVersion(tx, id, dto.version, data);
    if (affected === 0) {
      throw AppException.conflict(ErrorKeys.VERSION_CONFLICT, {
        expected: dto.version,
        actual: before.version,
      });
    }

    const after = await tx.person.findFirst({ where: { id } });
    await this.audit.recordTx(tx, {
      action: 'person.update',
      entityType: 'Person',
      entityId: id,
      before,
      after,
    });
    return after as Person;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.tenantTransaction((tx) => this.softDeleteInTx(tx, id));
  }

  /** Soft-delete within an existing tenant transaction (shared by M1 + M2 publisher). */
  async softDeleteInTx(tx: TenantTransactionClient, id: string): Promise<void> {
    const before = await tx.person.findFirst({ where: { id, deletedAt: null } });
    if (!before) {
      throw AppException.notFound(ErrorKeys.PERSON_NOT_FOUND, { id });
    }
    await this.lineage.onSoftDelete(tx, id);
    const after = await this.repo.softDelete(tx, id);
    await this.audit.recordTx(tx, {
      action: 'person.delete',
      entityType: 'Person',
      entityId: id,
      before,
      after,
    });
  }

  // -------------------------------------------------------------------------

  private buildUpdateData(
    before: Person,
    dto: UpdatePersonDto,
    nextFatherId: string | null,
    nextMotherId: string | null,
  ): Prisma.PersonUncheckedUpdateInput {
    const nameChanged =
      dto.firstName !== undefined ||
      dto.fatherName !== undefined ||
      dto.grandfatherName !== undefined ||
      dto.familyName !== undefined;

    const data: Prisma.PersonUncheckedUpdateInput = {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.fatherName !== undefined ? { fatherName: dto.fatherName ?? null } : {}),
      ...(dto.grandfatherName !== undefined
        ? { grandfatherName: dto.grandfatherName ?? null }
        : {}),
      ...(dto.familyName !== undefined ? { familyName: dto.familyName ?? null } : {}),
      ...(dto.laqab !== undefined ? { laqab: dto.laqab ?? null } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.birthDate !== undefined ? { birthDate: parsePartialDate(dto.birthDate) } : {}),
      ...(dto.birthPlace !== undefined ? { birthPlace: dto.birthPlace ?? null } : {}),
      ...(dto.deathDate !== undefined ? { deathDate: parsePartialDate(dto.deathDate) } : {}),
      ...(dto.isDeceased !== undefined ? { isDeceased: dto.isDeceased } : {}),
      ...(dto.fatherId !== undefined ? { fatherId: nextFatherId } : {}),
      ...(dto.motherId !== undefined ? { motherId: nextMotherId } : {}),
      ...(dto.tribalUnitId !== undefined ? { tribalUnitId: dto.tribalUnitId ?? null } : {}),
      ...(dto.profession !== undefined ? { profession: dto.profession ?? null } : {}),
    };

    if (nameChanged) {
      data.fullName = buildFullName({
        firstName: dto.firstName ?? before.firstName,
        fatherName: dto.fatherName !== undefined ? dto.fatherName : before.fatherName,
        grandfatherName:
          dto.grandfatherName !== undefined ? dto.grandfatherName : before.grandfatherName,
        familyName: dto.familyName !== undefined ? dto.familyName : before.familyName,
      });
    }
    return data;
  }

  private async validateParents(
    tx: TenantTransactionClient,
    fatherId: string | null,
    motherId: string | null,
  ): Promise<void> {
    if (fatherId) {
      const father = await tx.person.findFirst({ where: { id: fatherId, deletedAt: null } });
      if (!father) {
        throw AppException.badRequest(ErrorKeys.PARENT_NOT_FOUND, { fatherId });
      }
      if (father.gender !== Gender.male) {
        throw AppException.badRequest(ErrorKeys.FATHER_MUST_BE_MALE, { fatherId });
      }
    }
    if (motherId) {
      const mother = await tx.person.findFirst({ where: { id: motherId, deletedAt: null } });
      if (!mother) {
        throw AppException.badRequest(ErrorKeys.PARENT_NOT_FOUND, { motherId });
      }
      if (mother.gender !== Gender.female) {
        throw AppException.badRequest(ErrorKeys.MOTHER_MUST_BE_FEMALE, { motherId });
      }
    }
  }

  private async findDuplicates(
    tx: TenantTransactionClient,
    fullName: string,
    tribalUnitId: string | null,
  ): Promise<DuplicateCandidate[]> {
    const rows = await this.repo.duplicateCandidates(
      tx,
      fullName,
      tribalUnitId,
      this.duplicateThreshold,
    );
    if (rows.length === 0) {
      return [];
    }
    const persons = await tx.person.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, fullName: true, fatherName: true, tribalUnitId: true },
    });
    const byId = new Map(persons.map((p) => [p.id, p]));
    return rows
      .map((r) => {
        const person = byId.get(r.id);
        return person ? { person, similarity: Number(r.score) } : undefined;
      })
      .filter((c): c is DuplicateCandidate => c !== undefined);
  }

  // ---- lineage read passthrough (keeps controller thin) --------------------

  getAncestors(id: string): Promise<Person[]> {
    return this.lineage.getAncestors(id);
  }

  getDescendants(id: string): Promise<Person[]> {
    return this.lineage.getDescendants(id);
  }
}

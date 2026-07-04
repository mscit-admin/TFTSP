import { Injectable } from '@nestjs/common';
import { Person, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';
import { normalizedSql } from '../../common/util/arabic';

export interface DuplicateRow {
  id: string;
  score: number;
}

@Injectable()
export class PersonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Person | null> {
    return this.prisma.tenant.person.findFirst({ where: { id, deletedAt: null } });
  }

  count(where: Prisma.PersonWhereInput): Promise<number> {
    return this.prisma.tenant.person.count({ where });
  }

  findMany(where: Prisma.PersonWhereInput, skip: number, take: number): Promise<Person[]> {
    return this.prisma.tenant.person.findMany({
      where,
      skip,
      take,
      orderBy: { fullName: 'asc' },
    });
  }

  loadByIds(ids: string[]): Promise<Person[]> {
    return this.prisma.tenant.person.findMany({ where: { id: { in: ids }, deletedAt: null } });
  }

  /** Trigram fuzzy search returning ids ordered by similarity. Runs under RLS. */
  searchIds(query: string, skip: number, take: number): Promise<Array<{ id: string }>> {
    const norm = normalizedSql(query);
    return this.prisma.tenantTransaction(
      (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM persons
        WHERE deleted_at IS NULL
          AND name_normalized % ${norm}
        ORDER BY similarity(name_normalized, ${norm}) DESC, full_name ASC
        LIMIT ${take} OFFSET ${skip}
      `,
    );
  }

  countSearch(query: string): Promise<number> {
    const norm = normalizedSql(query);
    return this.prisma
      .tenantTransaction(
        (tx) =>
          tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count
          FROM persons
          WHERE deleted_at IS NULL AND name_normalized % ${norm}
        `,
      )
      .then((rows) => Number(rows[0]?.count ?? 0));
  }

  /**
   * Duplicate pre-check (Spec §8): similarity on the normalized full name within
   * the same tribal unit (clan), threshold applied by the caller. Runs inside the
   * caller's tenant transaction so it shares the create's RLS/atomicity.
   */
  duplicateCandidates(
    tx: TenantTransactionClient,
    fullName: string,
    tribalUnitId: string | null,
    threshold: number,
  ): Promise<DuplicateRow[]> {
    const norm = normalizedSql(fullName);
    const unitClause =
      tribalUnitId === null
        ? Prisma.sql`tribal_unit_id IS NULL`
        : Prisma.sql`tribal_unit_id = ${tribalUnitId}::uuid`;
    return tx.$queryRaw<DuplicateRow[]>`
      SELECT id, similarity(name_normalized, ${norm}) AS score
      FROM persons
      WHERE deleted_at IS NULL
        AND ${unitClause}
        AND similarity(name_normalized, ${norm}) >= ${threshold}
      ORDER BY score DESC
      LIMIT 10
    `;
  }

  create(tx: TenantTransactionClient, data: Prisma.PersonUncheckedCreateInput): Promise<Person> {
    return tx.person.create({ data });
  }

  /** Optimistic-locked update: returns the affected row count (0 => version mismatch). */
  async updateWithVersion(
    tx: TenantTransactionClient,
    id: string,
    expectedVersion: number,
    data: Prisma.PersonUncheckedUpdateInput,
  ): Promise<number> {
    const result = await tx.person.updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count;
  }

  softDelete(tx: TenantTransactionClient, id: string): Promise<Person> {
    return tx.person.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

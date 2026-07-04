import { Injectable } from '@nestjs/common';
import { ImportBatch, ImportRow, ImportRowStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';

/**
 * Import staging data access. Request-time reads/writes use the RLS app client.
 * The BullMQ worker (no HTTP/tenant context) uses the owner client with an
 * EXPLICIT tenantId (like the M2 jobs — D-203).
 */
@Injectable()
export class ImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- request-time (RLS app client) --------------------------------------

  createBatch(data: Prisma.ImportBatchUncheckedCreateInput): Promise<ImportBatch> {
    return this.prisma.tenant.importBatch.create({ data });
  }

  findBatch(id: string): Promise<ImportBatch | null> {
    return this.prisma.tenant.importBatch.findUnique({ where: { id } });
  }

  listBatches(skip: number, take: number): Promise<ImportBatch[]> {
    return this.prisma.tenant.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countBatches(): Promise<number> {
    return this.prisma.tenant.importBatch.count();
  }

  updateBatch(id: string, data: Prisma.ImportBatchUncheckedUpdateInput): Promise<ImportBatch> {
    return this.prisma.tenant.importBatch.update({ where: { id }, data });
  }

  findRow(batchId: string, rowId: string): Promise<ImportRow | null> {
    return this.prisma.tenant.importRow.findFirst({ where: { id: rowId, importBatchId: batchId } });
  }

  listRows(
    batchId: string,
    status: ImportRowStatus | undefined,
    skip: number,
    take: number,
  ): Promise<ImportRow[]> {
    return this.prisma.tenant.importRow.findMany({
      where: { importBatchId: batchId, ...(status ? { status } : {}) },
      orderBy: { rowNumber: 'asc' },
      skip,
      take,
    });
  }

  countRows(batchId: string, status?: ImportRowStatus): Promise<number> {
    return this.prisma.tenant.importRow.count({
      where: { importBatchId: batchId, ...(status ? { status } : {}) },
    });
  }

  updateRow(rowId: string, data: Prisma.ImportRowUncheckedUpdateInput): Promise<ImportRow> {
    return this.prisma.tenant.importRow.update({ where: { id: rowId }, data });
  }

  // ---- worker-time (owner client, explicit tenantId) ----------------------

  ownerFindBatch(id: string): Promise<ImportBatch | null> {
    return this.prisma.platform.importBatch.findUnique({ where: { id } });
  }

  ownerUpdateBatch(id: string, data: Prisma.ImportBatchUncheckedUpdateInput): Promise<ImportBatch> {
    return this.prisma.platform.importBatch.update({ where: { id }, data });
  }

  ownerInsertRows(rows: Prisma.ImportRowUncheckedCreateInput[]): Promise<Prisma.BatchPayload> {
    return this.prisma.platform.importRow.createMany({ data: rows });
  }

  ownerListRows(batchId: string, status?: ImportRowStatus): Promise<ImportRow[]> {
    return this.prisma.platform.importRow.findMany({
      where: { importBatchId: batchId, ...(status ? { status } : {}) },
      orderBy: { rowNumber: 'asc' },
    });
  }

  ownerUpdateRow(rowId: string, data: Prisma.ImportRowUncheckedUpdateInput): Promise<ImportRow> {
    return this.prisma.platform.importRow.update({ where: { id: rowId }, data });
  }

  ownerCountByStatus(batchId: string): Promise<Array<{ status: ImportRowStatus; count: number }>> {
    return this.prisma.platform.importRow
      .groupBy({ by: ['status'], where: { importBatchId: batchId }, _count: { _all: true } })
      .then((rows) => rows.map((r) => ({ status: r.status, count: r._count._all })));
  }

  /** Tenant person count (owner client) for the plan-limit guard. */
  ownerPersonCount(tenantId: string): Promise<number> {
    return this.prisma.platform.person.count({ where: { tenantId, deletedAt: null } });
  }

  ownerTenantMaxPersons(tenantId: string): Promise<number> {
    return this.prisma.platform.tenant
      .findUnique({ where: { id: tenantId }, select: { maxPersons: true } })
      .then((t) => t?.maxPersons ?? 500);
  }

  // ---- rollback support ----------------------------------------------------

  /** Rows/persons created by this batch (owner client) for rollback dependency checks. */
  ownerBatchPersonIds(tenantId: string, batchId: string): Promise<string[]> {
    return this.prisma.platform.person
      .findMany({ where: { tenantId, importBatchId: batchId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));
  }

  updateBatchTx(
    tx: TenantTransactionClient,
    id: string,
    data: Prisma.ImportBatchUncheckedUpdateInput,
  ): Promise<ImportBatch> {
    return tx.importBatch.update({ where: { id }, data });
  }
}

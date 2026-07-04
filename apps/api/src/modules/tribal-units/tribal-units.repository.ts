import { Injectable } from '@nestjs/common';
import { Prisma, TribalUnit } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';

/** Tenant-scoped: all reads/writes go through the RLS app client. */
@Injectable()
export class TribalUnitsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  findAll(): Promise<TribalUnit[]> {
    return this.prisma.tenant.tribalUnit.findMany({ orderBy: { nameAr: 'asc' } });
  }

  findById(id: string): Promise<TribalUnit | null> {
    return this.prisma.tenant.tribalUnit.findUnique({ where: { id } });
  }

  create(data: Omit<Prisma.TribalUnitUncheckedCreateInput, 'tenantId'>): Promise<TribalUnit> {
    return this.prisma.tenant.tribalUnit.create({
      data: { ...data, tenantId: this.tenantContext.requireTenantId() },
    });
  }

  update(id: string, data: Prisma.TribalUnitUpdateInput): Promise<TribalUnit> {
    return this.prisma.tenant.tribalUnit.update({ where: { id }, data });
  }

  delete(id: string): Promise<TribalUnit> {
    return this.prisma.tenant.tribalUnit.delete({ where: { id } });
  }

  // ---- transaction variants (used by the M2 change-request publisher) ----

  findByIdTx(tx: TenantTransactionClient, id: string): Promise<TribalUnit | null> {
    return tx.tribalUnit.findUnique({ where: { id } });
  }

  createTx(
    tx: TenantTransactionClient,
    data: Omit<Prisma.TribalUnitUncheckedCreateInput, 'tenantId'>,
  ): Promise<TribalUnit> {
    return tx.tribalUnit.create({
      data: { ...data, tenantId: this.tenantContext.requireTenantId() },
    });
  }

  updateTx(
    tx: TenantTransactionClient,
    id: string,
    data: Prisma.TribalUnitUncheckedUpdateInput,
  ): Promise<TribalUnit> {
    return tx.tribalUnit.update({ where: { id }, data });
  }

  deleteTx(tx: TenantTransactionClient, id: string): Promise<TribalUnit> {
    return tx.tribalUnit.delete({ where: { id } });
  }
}

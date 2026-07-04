import { Injectable } from '@nestjs/common';
import { Prisma, Union } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';

@Injectable()
export class UnionsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  findAll(): Promise<Union[]> {
    return this.prisma.tenant.union.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findById(id: string): Promise<Union | null> {
    return this.prisma.tenant.union.findUnique({ where: { id } });
  }

  create(data: Omit<Prisma.UnionUncheckedCreateInput, 'tenantId'>): Promise<Union> {
    return this.prisma.tenant.union.create({
      data: { ...data, tenantId: this.tenantContext.requireTenantId() },
    });
  }

  update(id: string, data: Prisma.UnionUpdateInput): Promise<Union> {
    return this.prisma.tenant.union.update({ where: { id }, data });
  }

  // ---- transaction variants (used by the M2 change-request publisher) ----

  findByIdTx(tx: TenantTransactionClient, id: string): Promise<Union | null> {
    return tx.union.findUnique({ where: { id } });
  }

  createTx(
    tx: TenantTransactionClient,
    data: Omit<Prisma.UnionUncheckedCreateInput, 'tenantId'>,
  ): Promise<Union> {
    return tx.union.create({
      data: { ...data, tenantId: this.tenantContext.requireTenantId() },
    });
  }

  updateTx(
    tx: TenantTransactionClient,
    id: string,
    data: Prisma.UnionUncheckedUpdateInput,
  ): Promise<Union> {
    return tx.union.update({ where: { id }, data });
  }

  deleteTx(tx: TenantTransactionClient, id: string): Promise<Union> {
    return tx.union.delete({ where: { id } });
  }
}

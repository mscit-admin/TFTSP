import { Injectable } from '@nestjs/common';
import { Prisma, TribalUnit } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

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
}

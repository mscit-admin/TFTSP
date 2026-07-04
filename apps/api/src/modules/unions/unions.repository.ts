import { Injectable } from '@nestjs/common';
import { Prisma, Union } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

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
}

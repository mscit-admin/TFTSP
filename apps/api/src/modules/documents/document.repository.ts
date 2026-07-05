import { Injectable } from '@nestjs/common';
import { PersonDocument, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

/** Tenant-scoped (RLS). */
@Injectable()
export class DocumentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  create(
    data: Omit<Prisma.PersonDocumentUncheckedCreateInput, 'tenantId'>,
  ): Promise<PersonDocument> {
    return this.prisma.tenant.personDocument.create({
      data: { ...data, tenantId: this.tenantContext.requireTenantId() },
    });
  }

  listForPerson(personId: string): Promise<PersonDocument[]> {
    return this.prisma.tenant.personDocument.findMany({
      where: { personId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<PersonDocument | null> {
    return this.prisma.tenant.personDocument.findFirst({ where: { id, deletedAt: null } });
  }

  softDelete(id: string): Promise<PersonDocument> {
    return this.prisma.tenant.personDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

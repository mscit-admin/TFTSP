import { Injectable } from '@nestjs/common';
import { Gender, Union, UnionStatus } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parsePartialDate } from '../../common/util/dates';
import { AuditService } from '../audit/audit.service';
import { CreateUnionDto, EndUnionDto, RemarryDto } from './dto/union.dto';
import { UnionsRepository } from './unions.repository';

@Injectable()
export class UnionsService {
  constructor(
    private readonly repo: UnionsRepository,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  findAll(): Promise<Union[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<Union> {
    const union = await this.repo.findById(id);
    if (!union) {
      throw AppException.notFound(ErrorKeys.UNION_NOT_FOUND, { id });
    }
    return union;
  }

  async create(dto: CreateUnionDto): Promise<Union> {
    await this.assertValidCouple(dto.husbandId, dto.wifeId);
    const union = await this.repo.create({
      husbandId: dto.husbandId,
      wifeId: dto.wifeId,
      marriageDate: parsePartialDate(dto.marriageDate),
      status: UnionStatus.active,
    });
    await this.audit.record({
      action: 'union.create',
      entityType: 'Union',
      entityId: union.id,
      after: union,
    });
    return union;
  }

  divorce(id: string, dto: EndUnionDto): Promise<Union> {
    return this.endUnion(id, UnionStatus.divorced, dto, 'union.divorce');
  }

  widow(id: string, dto: EndUnionDto): Promise<Union> {
    return this.endUnion(id, UnionStatus.widowed, dto, 'union.widow');
  }

  /** Remarry: a fresh active union between the same partners after a prior one ended. */
  async remarry(id: string, dto: RemarryDto): Promise<Union> {
    const previous = await this.findOne(id);
    const union = await this.repo.create({
      husbandId: previous.husbandId,
      wifeId: previous.wifeId,
      marriageDate: parsePartialDate(dto.marriageDate),
      status: UnionStatus.active,
    });
    await this.audit.record({
      action: 'union.remarry',
      entityType: 'Union',
      entityId: union.id,
      before: { previousUnionId: id },
      after: union,
    });
    return union;
  }

  // -------------------------------------------------------------------------

  private async endUnion(
    id: string,
    status: UnionStatus,
    dto: EndUnionDto,
    action: string,
  ): Promise<Union> {
    const before = await this.findOne(id);
    if (before.status !== UnionStatus.active) {
      throw AppException.badRequest(ErrorKeys.UNION_ALREADY_ENDED, { id });
    }
    const updated = await this.repo.update(id, {
      status,
      endDate: parsePartialDate(dto.endDate),
      endReason: dto.endReason ?? null,
    });
    await this.audit.record({
      action,
      entityType: 'Union',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  private async assertValidCouple(husbandId: string, wifeId: string): Promise<void> {
    const [husband, wife] = await Promise.all([
      this.prisma.tenant.person.findFirst({ where: { id: husbandId, deletedAt: null } }),
      this.prisma.tenant.person.findFirst({ where: { id: wifeId, deletedAt: null } }),
    ]);
    if (!husband || !wife) {
      throw AppException.notFound(ErrorKeys.PERSON_NOT_FOUND, { husbandId, wifeId });
    }
    if (husband.gender !== Gender.male || wife.gender !== Gender.female) {
      throw AppException.badRequest(ErrorKeys.INVALID_UNION_GENDERS, { husbandId, wifeId });
    }
  }
}

import { Injectable } from '@nestjs/common';
import { TribalUnit } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { AuditService } from '../audit/audit.service';
import { CreateTribalUnitDto, UpdateTribalUnitDto } from './dto/tribal-unit.dto';
import { TribalUnitsRepository } from './tribal-units.repository';

@Injectable()
export class TribalUnitsService {
  constructor(
    private readonly repo: TribalUnitsRepository,
    private readonly audit: AuditService,
  ) {}

  findAll(): Promise<TribalUnit[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<TribalUnit> {
    const unit = await this.repo.findById(id);
    if (!unit) {
      throw AppException.notFound(ErrorKeys.TRIBAL_UNIT_NOT_FOUND, { id });
    }
    return unit;
  }

  async create(dto: CreateTribalUnitDto): Promise<TribalUnit> {
    if (dto.parentId) {
      await this.findOne(dto.parentId); // RLS ensures same tenant, else 404
    }
    const unit = await this.repo.create({
      parentId: dto.parentId ?? null,
      unitType: dto.unitType,
      nameAr: dto.nameAr,
      nameEn: dto.nameEn,
    });
    await this.audit.record({
      action: 'tribalUnit.create',
      entityType: 'TribalUnit',
      entityId: unit.id,
      after: unit,
    });
    return unit;
  }

  async update(id: string, dto: UpdateTribalUnitDto): Promise<TribalUnit> {
    const before = await this.findOne(id);
    if (dto.parentId) {
      await this.findOne(dto.parentId);
    }
    const updated = await this.repo.update(id, {
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      ...(dto.unitType !== undefined ? { unitType: dto.unitType } : {}),
      ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
      ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
    });
    await this.audit.record({
      action: 'tribalUnit.update',
      entityType: 'TribalUnit',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(id: string): Promise<void> {
    const before = await this.findOne(id);
    await this.repo.delete(id);
    await this.audit.record({
      action: 'tribalUnit.delete',
      entityType: 'TribalUnit',
      entityId: id,
      before,
    });
  }
}

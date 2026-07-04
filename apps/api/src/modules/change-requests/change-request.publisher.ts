import { Injectable } from '@nestjs/common';
import { ChangeOperation, ChangeRequest, ChangeTargetType } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';
import { patchToFieldObject, JsonPatchOp } from '../../common/util/json-patch';
import { parsePartialDate } from '../../common/util/dates';
import { AuditService } from '../audit/audit.service';
import { PersonsService } from '../persons/persons.service';
import { UnionsRepository } from '../unions/unions.repository';
import { TribalUnitsRepository } from '../tribal-units/tribal-units.repository';
import { CreatePersonDto } from '../persons/dto/create-person.dto';
import { UpdatePersonDto } from '../persons/dto/update-person.dto';

export type PublishOutcome =
  { outcome: 'published'; targetId: string | null } | { outcome: 'conflict' };

/**
 * Applies an approved change request to live data (Spec §3 M2). Runs inside the
 * caller's tenant transaction so the apply + CR status update are atomic. Re-checks
 * conflicts against `baseVersion` for versioned targets (person). Reuses the M1
 * write paths (lineage/audit) via *InTx methods.
 */
@Injectable()
export class ChangeRequestPublisher {
  constructor(
    private readonly persons: PersonsService,
    private readonly unions: UnionsRepository,
    private readonly tribalUnits: TribalUnitsRepository,
    private readonly audit: AuditService,
  ) {}

  async apply(tx: TenantTransactionClient, cr: ChangeRequest): Promise<PublishOutcome> {
    const patch = cr.patch as unknown as JsonPatchOp[];
    switch (cr.targetType) {
      case ChangeTargetType.person:
        return this.applyPerson(tx, cr, patch);
      case ChangeTargetType.union:
        return this.applyUnion(tx, cr, patch);
      case ChangeTargetType.tribal_unit:
        return this.applyTribalUnit(tx, cr, patch);
      default:
        return { outcome: 'conflict' };
    }
  }

  // ---- person (versioned → real conflict re-check) -------------------------

  private async applyPerson(
    tx: TenantTransactionClient,
    cr: ChangeRequest,
    patch: JsonPatchOp[],
  ): Promise<PublishOutcome> {
    const fields = patchToFieldObject(patch);

    if (cr.operation === ChangeOperation.create) {
      const dto: CreatePersonDto = {
        ...(fields as unknown as CreatePersonDto),
        confirmDuplicate: true,
      };
      const person = await this.persons.createInTx(tx, dto, cr.createdBy);
      return { outcome: 'published', targetId: person.id };
    }

    if (!cr.targetId || cr.baseVersion === null) {
      return { outcome: 'conflict' };
    }
    const current = await tx.person.findFirst({ where: { id: cr.targetId, deletedAt: null } });
    if (!current || current.version !== cr.baseVersion) {
      return { outcome: 'conflict' };
    }

    try {
      if (cr.operation === ChangeOperation.update) {
        const dto = { ...fields, version: cr.baseVersion } as unknown as UpdatePersonDto;
        await this.persons.updateInTx(tx, cr.targetId, dto);
      } else {
        await this.persons.softDeleteInTx(tx, cr.targetId);
      }
    } catch (err) {
      // A version/not-found race surfaces as a conflict, not a hard error.
      if (
        err instanceof AppException &&
        (err.messageKey === ErrorKeys.VERSION_CONFLICT ||
          err.messageKey === ErrorKeys.PERSON_NOT_FOUND)
      ) {
        return { outcome: 'conflict' };
      }
      throw err;
    }
    return { outcome: 'published', targetId: cr.targetId };
  }

  // ---- union (no version column → existence-based conflict) ----------------

  private async applyUnion(
    tx: TenantTransactionClient,
    cr: ChangeRequest,
    patch: JsonPatchOp[],
  ): Promise<PublishOutcome> {
    const fields = patchToFieldObject(patch);

    if (cr.operation === ChangeOperation.create) {
      const created = await this.unions.createTx(tx, {
        husbandId: String(fields.husbandId),
        wifeId: String(fields.wifeId),
        marriageDate: parsePartialDate(fields.marriageDate as string | undefined),
      });
      await this.audit.recordTx(tx, {
        action: 'union.create',
        entityType: 'Union',
        entityId: created.id,
        after: created,
      });
      return { outcome: 'published', targetId: created.id };
    }

    if (!cr.targetId) {
      return { outcome: 'conflict' };
    }
    const before = await this.unions.findByIdTx(tx, cr.targetId);
    if (!before) {
      return { outcome: 'conflict' };
    }

    if (cr.operation === ChangeOperation.delete) {
      await this.unions.deleteTx(tx, cr.targetId);
      await this.audit.recordTx(tx, {
        action: 'union.delete',
        entityType: 'Union',
        entityId: cr.targetId,
        before,
      });
    } else {
      const after = await this.unions.updateTx(tx, cr.targetId, {
        ...(fields.marriageDate !== undefined
          ? { marriageDate: parsePartialDate(fields.marriageDate as string) }
          : {}),
        ...(fields.endDate !== undefined
          ? { endDate: parsePartialDate(fields.endDate as string) }
          : {}),
        ...(fields.status !== undefined ? { status: fields.status as never } : {}),
        ...(fields.endReason !== undefined ? { endReason: fields.endReason as string } : {}),
      });
      await this.audit.recordTx(tx, {
        action: 'union.update',
        entityType: 'Union',
        entityId: cr.targetId,
        before,
        after,
      });
    }
    return { outcome: 'published', targetId: cr.targetId };
  }

  // ---- tribal_unit (no version column → existence-based conflict) ----------

  private async applyTribalUnit(
    tx: TenantTransactionClient,
    cr: ChangeRequest,
    patch: JsonPatchOp[],
  ): Promise<PublishOutcome> {
    const fields = patchToFieldObject(patch);

    if (cr.operation === ChangeOperation.create) {
      const created = await this.tribalUnits.createTx(tx, {
        parentId: (fields.parentId as string | undefined) ?? null,
        unitType: fields.unitType as never,
        nameAr: String(fields.nameAr ?? ''),
        nameEn: String(fields.nameEn ?? ''),
      });
      await this.audit.recordTx(tx, {
        action: 'tribalUnit.create',
        entityType: 'TribalUnit',
        entityId: created.id,
        after: created,
      });
      return { outcome: 'published', targetId: created.id };
    }

    if (!cr.targetId) {
      return { outcome: 'conflict' };
    }
    const before = await this.tribalUnits.findByIdTx(tx, cr.targetId);
    if (!before) {
      return { outcome: 'conflict' };
    }

    if (cr.operation === ChangeOperation.delete) {
      await this.tribalUnits.deleteTx(tx, cr.targetId);
      await this.audit.recordTx(tx, {
        action: 'tribalUnit.delete',
        entityType: 'TribalUnit',
        entityId: cr.targetId,
        before,
      });
    } else {
      const after = await this.tribalUnits.updateTx(tx, cr.targetId, {
        ...(fields.parentId !== undefined ? { parentId: fields.parentId as string | null } : {}),
        ...(fields.unitType !== undefined ? { unitType: fields.unitType as never } : {}),
        ...(fields.nameAr !== undefined ? { nameAr: String(fields.nameAr) } : {}),
        ...(fields.nameEn !== undefined ? { nameEn: String(fields.nameEn) } : {}),
      });
      await this.audit.recordTx(tx, {
        action: 'tribalUnit.update',
        entityType: 'TribalUnit',
        entityId: cr.targetId,
        before,
        after,
      });
    }
    return { outcome: 'published', targetId: cr.targetId };
  }
}

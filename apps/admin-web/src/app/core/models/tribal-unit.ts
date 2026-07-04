// Local mirror of packages/shared-types/src/tribal-unit.ts (Spec Section 5).
export type UnitType = 'tribe' | 'branch' | 'clan' | 'family';

export interface TribalUnit {
  id: string;
  tenantId: string;
  parentId?: string | null;
  unitType: UnitType;
  nameAr: string;
  nameEn: string;
}

export interface CreateTribalUnitDto {
  parentId?: string;
  unitType: UnitType;
  nameAr: string;
  nameEn: string;
}

export type UpdateTribalUnitDto = Partial<CreateTribalUnitDto>;

/** Allowed child type for each unit type (tribe -> branch -> clan -> family). */
export const CHILD_UNIT_TYPE: Record<UnitType, UnitType | null> = {
  tribe: 'branch',
  branch: 'clan',
  clan: 'family',
  family: null,
};

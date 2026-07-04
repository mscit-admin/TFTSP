export type UnitType = 'tribe' | 'branch' | 'clan' | 'family';

/** TribalUnit — self-referential hierarchy: tribe -> branch -> clan -> family. Spec Section 5. */
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

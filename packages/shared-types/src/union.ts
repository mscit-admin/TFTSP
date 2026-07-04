export type UnionStatus = 'active' | 'divorced' | 'widowed';

/** Union (marriage) — independent entity, Spec Section 5. Supports polygamy, divorce, remarriage. */
export interface Union {
  id: string;
  tenantId: string;
  husbandId: string;
  wifeId: string;
  marriageDate?: string | null;
  status: UnionStatus;
  endDate?: string | null;
  endReason?: string | null;
}

export interface CreateUnionDto {
  husbandId: string;
  wifeId: string;
  marriageDate?: string;
}

export interface EndUnionDto {
  status: Exclude<UnionStatus, 'active'>;
  endDate: string;
  endReason?: string;
}

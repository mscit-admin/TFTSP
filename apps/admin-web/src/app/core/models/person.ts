// Local mirror of packages/shared-types/src/person.ts (Spec Section 5).
export type Gender = 'male' | 'female';
export type PersonStatus = 'draft' | 'published' | 'archived';

export interface Person {
  id: string;
  tenantId: string;
  fullName: string;
  firstName: string;
  fatherName?: string | null;
  grandfatherName?: string | null;
  familyName?: string | null;
  laqab?: string | null;
  gender: Gender;
  birthDate?: string | null; // ISO; partial dates (year-only) supported as YYYY or YYYY-01-01
  birthPlace?: string | null;
  deathDate?: string | null;
  deathPlace?: string | null;
  isDeceased: boolean;
  fatherId?: string | null;
  motherId?: string | null;
  tribalUnitId?: string | null;
  profession?: string | null;
  photoKey?: string | null;
  status: PersonStatus;
  version: number; // optimistic locking
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreatePersonDto {
  firstName: string;
  fatherName?: string;
  grandfatherName?: string;
  familyName?: string;
  laqab?: string;
  gender: Gender;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  isDeceased?: boolean;
  fatherId?: string;
  motherId?: string;
  tribalUnitId?: string;
  profession?: string;
  /** required to proceed when duplicate candidates (similarity >= 0.6) were returned */
  confirmDuplicate?: boolean;
}

export type UpdatePersonDto = Partial<CreatePersonDto> & { version: number };

export interface DuplicateCandidate {
  person: Pick<Person, 'id' | 'fullName' | 'fatherName' | 'tribalUnitId'>;
  similarity: number;
}

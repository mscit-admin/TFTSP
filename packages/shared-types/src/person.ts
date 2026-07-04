export type Gender = 'male' | 'female';
export type PersonStatus = 'draft' | 'published' | 'archived';

/** Person entity — Spec Section 5. Blocked fields are omitted (not nulled) by the Visibility Resolver (M3). */
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
  birthDate?: string | null;      // ISO; partial dates (year-only) supported as YYYY or YYYY-01-01
  birthPlace?: string | null;
  deathDate?: string | null;
  deathPlace?: string | null;
  isDeceased: boolean;
  fatherId?: string | null;       // FK, nullable (multiple roots supported)
  motherId?: string | null;
  tribalUnitId?: string | null;   // FK -> clan/family
  profession?: string | null;
  photoKey?: string | null;       // MinIO object key
  status: PersonStatus;
  version: number;                // optimistic locking
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;      // soft delete
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

export type Role =
  | 'super_admin'
  | 'platform_admin'
  | 'tribe_admin'
  | 'deputy_admin'
  | 'branch_admin'
  | 'reviewer'
  | 'contributor'
  | 'viewer'
  | 'guest';

/** Role assignment — temporary rights & deputy modelled via valid_from/valid_to (Spec Section 6). */
export interface RoleAssignment {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  tribalUnitId?: string | null; // scopes branch_admin and below
  validFrom: string;
  validTo?: string | null;
}

/** Roles allowed to write persons/unions directly in M1 (approval workflow arrives in M2). */
export const M1_WRITE_ROLES: Role[] = ['tribe_admin', 'deputy_admin', 'branch_admin'];

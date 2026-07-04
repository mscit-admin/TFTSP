// Local mirror of packages/shared-types/src/roles.ts (kept in-app to avoid cross-workspace build coupling — DECISIONS D-202).
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

export interface RoleAssignment {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  tribalUnitId?: string | null;
  validFrom: string;
  validTo?: string | null;
}

/** Roles allowed to write persons/unions directly in M1 (approval workflow arrives in M2). */
export const M1_WRITE_ROLES: Role[] = ['tribe_admin', 'deputy_admin', 'branch_admin'];

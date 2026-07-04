import { Role } from '@prisma/client';

/**
 * Permission catalogue for M1. A permission maps to the set of roles that hold
 * it. Authorization is data-driven here and enforced ONLY by PolicyGuard reading
 * @RequirePermission — never by manual role checks in services (Spec §6).
 */
export type Permission =
  | 'person.read'
  | 'person.create'
  | 'person.update'
  | 'person.delete'
  | 'union.read'
  | 'union.write'
  | 'tribalUnit.read'
  | 'tribalUnit.write'
  | 'tree.read'
  | 'audit.read';

/** Roles allowed to write persons/unions directly in M1 (approval workflow = M2). */
export const M1_WRITE_ROLES: Role[] = [Role.tribe_admin, Role.deputy_admin, Role.branch_admin];

const READ_ROLES: Role[] = [
  Role.tribe_admin,
  Role.deputy_admin,
  Role.branch_admin,
  Role.reviewer,
  Role.contributor,
  Role.viewer,
];

export const PERMISSION_MATRIX: Record<Permission, Role[]> = {
  'person.read': READ_ROLES,
  'person.create': M1_WRITE_ROLES,
  'person.update': M1_WRITE_ROLES,
  'person.delete': [Role.tribe_admin, Role.deputy_admin],
  'union.read': READ_ROLES,
  'union.write': M1_WRITE_ROLES,
  'tribalUnit.read': READ_ROLES,
  'tribalUnit.write': [Role.tribe_admin, Role.deputy_admin],
  'tree.read': READ_ROLES,
  'audit.read': [Role.tribe_admin, Role.deputy_admin],
};

/**
 * Scope check strategy for a permission (Spec §6):
 *  - None: any active assignment with the permission grants access.
 *  - TribalUnit: branch_admin (and below) is restricted to their assigned
 *    tribal_unit and its descendants; unscoped admin roles pass unconditionally.
 */
export enum ScopeCheck {
  None = 'none',
  TribalUnit = 'tribalUnit',
}

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
  | 'audit.read'
  | 'tenant.read'
  | 'tenant.update'
  | 'changeRequest.create'
  | 'changeRequest.read'
  | 'changeRequest.review'
  | 'workflowSettings.read'
  | 'workflowSettings.update'
  | 'notification.read'
  | 'import.read'
  | 'import.create'
  | 'import.rollback'
  | 'visibilitySettings.read'
  | 'visibilitySettings.update'
  | 'viewRequest.manage'
  | 'document.read'
  | 'document.write'
  | 'export.read'
  | 'stats.read'
  | 'reputation.read'
  | 'reputation.manage';

/** Reviewer/approver roles (Spec §3 M2). */
export const M2_REVIEW_ROLES: Role[] = [Role.tribe_admin, Role.deputy_admin, Role.reviewer];

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
  // Tribe settings (logo/colors/names) — administrative, own tenant only.
  'tenant.read': [Role.tribe_admin, Role.deputy_admin],
  'tenant.update': [Role.tribe_admin, Role.deputy_admin],
  // Change requests (M2): non-admins route edits through these; admins may too.
  // Viewer is allowed to REACH the endpoint (M4 §13) but the service restricts
  // viewers to edit_data/add_source and only when the tribe enables it.
  'changeRequest.create': [
    Role.tribe_admin,
    Role.deputy_admin,
    Role.branch_admin,
    Role.reviewer,
    Role.contributor,
    Role.viewer,
  ],
  'changeRequest.read': READ_ROLES,
  'changeRequest.review': [Role.tribe_admin, Role.deputy_admin, Role.reviewer],
  'workflowSettings.read': [Role.tribe_admin, Role.deputy_admin],
  'workflowSettings.update': [Role.tribe_admin, Role.deputy_admin],
  'notification.read': READ_ROLES,
  // Bulk import (M2.5): admins upload/preview/submit; rollback is Tribe/Deputy Admin.
  'import.read': [Role.tribe_admin, Role.deputy_admin, Role.branch_admin],
  'import.create': [Role.tribe_admin, Role.deputy_admin, Role.branch_admin],
  'import.rollback': [Role.tribe_admin, Role.deputy_admin],
  // Visibility policy + view-request review (M3): Tribe/Deputy Admin.
  'visibilitySettings.read': [Role.tribe_admin, Role.deputy_admin],
  'visibilitySettings.update': [Role.tribe_admin, Role.deputy_admin],
  'viewRequest.manage': [Role.tribe_admin, Role.deputy_admin],
  // Documents / exports / stats / reputation (M4).
  'document.read': READ_ROLES,
  'document.write': [Role.tribe_admin, Role.deputy_admin, Role.branch_admin],
  'export.read': READ_ROLES,
  'stats.read': [Role.tribe_admin, Role.deputy_admin],
  'reputation.read': READ_ROLES,
  'reputation.manage': [Role.tribe_admin, Role.deputy_admin],
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

import { ContributionType, Role } from '@prisma/client';

/** Types a Viewer may suggest when the tribe enables visitor contributions (Spec §13.2). */
export const VIEWER_ALLOWED_CONTRIBUTIONS: ContributionType[] = [
  ContributionType.edit_data,
  ContributionType.add_source,
];

/** Roles that may contribute any type without the viewer restriction. */
export const CONTRIBUTOR_ROLES: Role[] = [
  Role.tribe_admin,
  Role.deputy_admin,
  Role.branch_admin,
  Role.reviewer,
  Role.contributor,
];

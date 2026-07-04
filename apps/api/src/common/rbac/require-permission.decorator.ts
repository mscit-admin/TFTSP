import { SetMetadata } from '@nestjs/common';
import { Permission, ScopeCheck } from './permissions';

export const PERMISSION_KEY = 'tftsp:permission';

export interface PermissionRequirement {
  permission: Permission;
  scope: ScopeCheck;
}

/**
 * Declares the permission (and scope strategy) required for a route. Read by the
 * central PolicyGuard. Example: `@RequirePermission('person.update', ScopeCheck.TribalUnit)`.
 */
export const RequirePermission = (permission: Permission, scope: ScopeCheck = ScopeCheck.None) =>
  SetMetadata<string, PermissionRequirement>(PERMISSION_KEY, { permission, scope });

import { SetMetadata } from '@nestjs/common';

export const IS_SUPER_ADMIN_KEY = 'tftsp:isSuperAdmin';

/** Marks a route as requiring the platform Super Admin (SuperAdminGuard). */
export const SuperAdminOnly = () => SetMetadata(IS_SUPER_ADMIN_KEY, true);

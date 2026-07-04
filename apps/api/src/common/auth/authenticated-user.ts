/** Shape attached to `req.user` after the JWT strategy validates an access token. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  /** Active tenant this access token is bound to. Undefined for super-admin-only tokens. */
  tenantId?: string;
}

/**
 * i18n error keys — the single source of truth for machine-readable error
 * identifiers. Controllers/services throw these; the exception filter maps them
 * to `{ statusCode, messageKey, details? }` and localises the message (Spec §11.3).
 * No hard-coded human strings anywhere in business code.
 */
export const ErrorKeys = {
  // auth
  INVALID_CREDENTIALS: 'errors.auth.invalid_credentials',
  ACCOUNT_LOCKED: 'errors.auth.account_locked',
  WEAK_PASSWORD: 'errors.auth.weak_password',
  INVALID_REFRESH_TOKEN: 'errors.auth.invalid_refresh_token',
  REFRESH_TOKEN_REUSED: 'errors.auth.refresh_token_reused',
  NO_TENANT_MEMBERSHIP: 'errors.auth.no_tenant_membership',
  UNAUTHORIZED: 'errors.auth.unauthorized',
  FORBIDDEN: 'errors.auth.forbidden',

  // tenant / platform
  TENANT_NOT_FOUND: 'errors.tenant.not_found',
  TENANT_SLUG_TAKEN: 'errors.tenant.slug_taken',
  TENANT_SUSPENDED: 'errors.tenant.suspended',
  EMAIL_TAKEN: 'errors.user.email_taken',

  // persons
  PERSON_NOT_FOUND: 'errors.person.not_found',
  VERSION_CONFLICT: 'errors.person.version_conflict',
  DUPLICATE_CANDIDATES: 'errors.person.duplicate_candidates',
  FATHER_MUST_BE_MALE: 'errors.person.father_must_be_male',
  MOTHER_MUST_BE_FEMALE: 'errors.person.mother_must_be_female',
  SELF_ANCESTRY: 'errors.person.self_ancestry',
  PARENT_NOT_FOUND: 'errors.person.parent_not_found',

  // unions
  UNION_NOT_FOUND: 'errors.union.not_found',
  UNION_ALREADY_ENDED: 'errors.union.already_ended',
  INVALID_UNION_GENDERS: 'errors.union.invalid_genders',

  // tribal units
  TRIBAL_UNIT_NOT_FOUND: 'errors.tribal_unit.not_found',

  // generic
  VALIDATION_FAILED: 'errors.validation.failed',
  NOT_FOUND: 'errors.generic.not_found',
  INTERNAL: 'errors.generic.internal',
} as const;

export type ErrorKey = (typeof ErrorKeys)[keyof typeof ErrorKeys];

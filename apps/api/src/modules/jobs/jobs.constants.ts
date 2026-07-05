export const CR_MAINTENANCE_QUEUE = 'change-request-maintenance';
export const JOB_EXPIRY_SWEEP = 'expiry-sweep';
export const JOB_EXPIRY_WARNING = 'expiry-warning';

/** M4: hourly refresh of the stats materialized views. */
export const STATS_QUEUE = 'stats-refresh';
export const JOB_STATS_REFRESH = 'stats-refresh';

/** Warn the owner when a request is within this many days of expiring. */
export const EXPIRY_WARNING_DAYS = 3;

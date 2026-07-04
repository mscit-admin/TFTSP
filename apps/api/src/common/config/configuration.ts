/** Central typed configuration derived from environment variables. */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  defaultLocale: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  auth: {
    maxFailedAttempts: number;
    lockMinutes: number;
    minPasswordLength: number;
  };
  duplicateSimilarityThreshold: number;
}

export function loadConfiguration(): AppConfig {
  const env = process.env;
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: parseInt(env.API_PORT ?? '3000', 10),
    logLevel: env.LOG_LEVEL ?? 'info',
    defaultLocale: env.DEFAULT_LOCALE ?? 'ar',
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET ?? 'change-me-access',
      refreshSecret: env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
      accessTtl: env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: env.JWT_REFRESH_TTL ?? '30d',
    },
    auth: {
      maxFailedAttempts: parseInt(env.AUTH_MAX_FAILED_ATTEMPTS ?? '5', 10),
      lockMinutes: parseInt(env.AUTH_LOCK_MINUTES ?? '15', 10),
      minPasswordLength: parseInt(env.AUTH_MIN_PASSWORD_LENGTH ?? '12', 10),
    },
    duplicateSimilarityThreshold: parseFloat(env.DUPLICATE_SIMILARITY_THRESHOLD ?? '0.6'),
  };
}

/**
 * Runtime configuration for platform-web.
 * `apiBaseUrl` is relative so it works behind the dev proxy (proxy.conf.json)
 * and behind Nginx in production without rebuilds.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  defaultLang: 'ar' as 'ar' | 'en',
};

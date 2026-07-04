export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  /** Same origin in prod — Nginx upgrades /socket.io to the backend gateway. */
  socketUrl: '',
};

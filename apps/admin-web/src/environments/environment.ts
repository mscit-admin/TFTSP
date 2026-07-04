export const environment = {
  production: false,
  /** All API calls go through the dev-server proxy (see proxy.conf.json) to http://localhost:3000. */
  apiBaseUrl: '/api/v1',
  /**
   * Socket.IO origin. Empty = same origin: the dev-server proxies `/socket.io` (ws)
   * to :3000 and Nginx does so in prod. Set an absolute URL only for cross-origin setups.
   */
  socketUrl: '',
};

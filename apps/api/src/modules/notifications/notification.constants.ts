/** Socket.IO event name (namespace `/notifications`). Mirrors shared-types. */
export const NOTIFICATION_WS_EVENT = 'notification' as const;

/** DI token for the set of notification delivery channels. */
export const NOTIFICATION_CHANNELS = 'NOTIFICATION_CHANNELS' as const;

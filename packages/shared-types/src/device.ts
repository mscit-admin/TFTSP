/** M5 — Mobile device registration for push (Spec §3·M5.7, FCM). */

export type DevicePlatform = 'android' | 'ios';

export interface DeviceRegistration {
  id: string;
  tenantId: string;
  userId: string;
  token: string; // FCM registration token
  platform: DevicePlatform;
  createdAt: string;
  lastSeenAt: string;
}

/** Registered on login / token refresh; removed on logout. */
export interface RegisterDeviceDto {
  token: string;
  platform: DevicePlatform;
}

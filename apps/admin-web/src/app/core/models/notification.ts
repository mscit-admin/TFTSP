// Local mirror of packages/shared-types/src/notification.ts (M2 — DECISIONS D-202 mirror policy).
export type NotificationType =
  | 'change_request_submitted'
  | 'change_request_approved'
  | 'change_request_rejected'
  | 'change_request_changes_requested'
  | 'change_request_published'
  | 'change_request_expiring'
  | 'change_request_expired'
  | 'change_request_conflict';

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  /** structured context, e.g. { changeRequestId, targetType } */
  payload: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: Notification[];
  unread: number;
  page: number;
  pageSize: number;
  total: number;
}

/** Socket.IO event name (namespace `/notifications`, JWT-authed, tenant-scoped room). */
export const NOTIFICATION_WS_EVENT = 'notification' as const;

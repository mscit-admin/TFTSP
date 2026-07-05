/** M2 — Notifications (in-app via WebSocket + email). Spec Section 3 · M2. */

export type NotificationType =
  | 'change_request_submitted'
  | 'change_request_approved'
  | 'change_request_rejected'
  | 'change_request_changes_requested'
  | 'change_request_published'
  | 'change_request_expiring'
  | 'change_request_expired'
  | 'change_request_conflict'
  /** M3 — non-member tree-view request awaiting admin review. */
  | 'view_request_submitted';

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

/** Socket.IO event names (namespace `/notifications`, JWT-authed, tenant-scoped room). */
export const NOTIFICATION_WS_EVENT = 'notification' as const;

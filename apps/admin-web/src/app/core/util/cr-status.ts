import type { ChangeRequestStatus } from '../models';

export type BadgeSeverity =
  | 'success'
  | 'info'
  | 'warn'
  | 'danger'
  | 'secondary'
  | 'contrast';

/** Maps a change-request status to a PrimeNG Tag severity for consistent badges. */
export function crStatusSeverity(status: ChangeRequestStatus): BadgeSeverity {
  switch (status) {
    case 'approved':
    case 'published':
      return 'success';
    case 'submitted':
    case 'under_review':
      return 'info';
    case 'changes_requested':
      return 'warn';
    case 'rejected':
    case 'conflict':
      return 'danger';
    case 'expired':
      return 'contrast';
    case 'draft':
    default:
      return 'secondary';
  }
}

/** i18n key for a status label. */
export function crStatusKey(status: ChangeRequestStatus): string {
  return `changeRequests.status.${status}`;
}

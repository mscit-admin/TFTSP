import type { ImportBatchStatus } from '../models';
import type { BadgeSeverity } from './cr-status';

/** Maps an import batch status to a PrimeNG Tag severity for consistent badges. */
export function importStatusSeverity(status: ImportBatchStatus): BadgeSeverity {
  switch (status) {
    case 'published':
      return 'success';
    case 'preview':
    case 'submitted':
      return 'info';
    case 'uploaded':
    case 'parsing':
    case 'validating':
    case 'resolving':
      return 'warn';
    case 'rejected':
    case 'failed':
      return 'danger';
    case 'rolled_back':
      return 'contrast';
    default:
      return 'secondary';
  }
}

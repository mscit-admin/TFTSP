import type { TrustLevel } from '../models';
import type { BadgeSeverity } from './cr-status';

/** Maps a contributor trust level to a PrimeNG Tag severity. */
export function trustSeverity(level: TrustLevel): BadgeSeverity {
  switch (level) {
    case 'gold':
      return 'warn';
    case 'silver':
      return 'secondary';
    case 'bronze':
    default:
      return 'contrast';
  }
}

/**
 * Parses a date that may be year-only (`YYYY`) or full ISO (Spec §5 — partial
 * dates supported). Year-only is stored as YYYY-01-01 UTC. Returns null for
 * empty/undefined input, throws for genuinely malformed values.
 */
export function parsePartialDate(value?: string | null): Date | null {
  if (value === undefined || value === null || value.trim() === '') {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(Date.UTC(parseInt(trimmed, 10), 0, 1));
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
}

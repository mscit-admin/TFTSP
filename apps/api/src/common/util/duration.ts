/** Parses a short duration string like `15m`, `30d`, `2h`, `45s` into milliseconds. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) {
      return asNumber * 1000; // bare seconds
    }
    throw new Error(`Invalid duration: ${value}`);
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * unitMs[unit];
}

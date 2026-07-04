import { parsePartialDate } from './dates';

describe('parsePartialDate', () => {
  it('returns null for empty input', () => {
    expect(parsePartialDate(undefined)).toBeNull();
    expect(parsePartialDate(null)).toBeNull();
    expect(parsePartialDate('  ')).toBeNull();
  });

  it('expands year-only to Jan 1 UTC', () => {
    const d = parsePartialDate('1965');
    expect(d?.toISOString()).toBe('1965-01-01T00:00:00.000Z');
  });

  it('passes through full ISO dates', () => {
    const d = parsePartialDate('1990-06-15');
    expect(d?.getUTCFullYear()).toBe(1990);
    expect(d?.getUTCMonth()).toBe(5);
  });

  it('throws on malformed dates', () => {
    expect(() => parsePartialDate('not-a-date')).toThrow();
  });
});

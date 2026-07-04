import { parseDurationMs } from './duration';

describe('parseDurationMs', () => {
  it('parses units', () => {
    expect(parseDurationMs('45s')).toBe(45_000);
    expect(parseDurationMs('15m')).toBe(900_000);
    expect(parseDurationMs('2h')).toBe(7_200_000);
    expect(parseDurationMs('30d')).toBe(2_592_000_000);
  });

  it('treats a bare number as seconds', () => {
    expect(parseDurationMs('60')).toBe(60_000);
  });

  it('throws on garbage', () => {
    expect(() => parseDurationMs('soon')).toThrow();
  });
});

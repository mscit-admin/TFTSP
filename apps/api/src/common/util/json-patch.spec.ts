import { applyJsonPatch, assertValidPatch, patchToFieldObject } from './json-patch';

describe('assertValidPatch', () => {
  it('accepts a well-formed patch', () => {
    expect(() =>
      assertValidPatch([{ op: 'replace', path: '/firstName', value: 'x' }]),
    ).not.toThrow();
  });

  it('rejects empty or malformed patches', () => {
    expect(() => assertValidPatch([])).toThrow();
    expect(() => assertValidPatch([{ op: 'bad', path: '/x' } as never])).toThrow();
    expect(() => assertValidPatch([{ op: 'add', path: 'no-slash' } as never])).toThrow();
  });
});

describe('applyJsonPatch', () => {
  it('applies add/replace/remove', () => {
    const out = applyJsonPatch({ firstName: 'a', laqab: 'x' }, [
      { op: 'replace', path: '/firstName', value: 'b' },
      { op: 'add', path: '/profession', value: 'farmer' },
      { op: 'remove', path: '/laqab' },
    ]);
    expect(out).toEqual({ firstName: 'b', profession: 'farmer' });
  });

  it('does not mutate the input', () => {
    const input = { firstName: 'a' };
    applyJsonPatch(input, [{ op: 'replace', path: '/firstName', value: 'z' }]);
    expect(input.firstName).toBe('a');
  });
});

describe('patchToFieldObject', () => {
  it('flattens ops to a field object, remove => null', () => {
    expect(
      patchToFieldObject([
        { op: 'replace', path: '/firstName', value: 'b' },
        { op: 'remove', path: '/fatherId' },
      ]),
    ).toEqual({ firstName: 'b', fatherId: null });
  });
});

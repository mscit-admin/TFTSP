import { Person, VisibilitySettings } from '@prisma/client';
import { VisibilityResolver, ViewerContext } from './visibility.resolver';

/**
 * Pure unit tests for the resolver's existence/redaction logic — the exact code
 * every read path (list, search, tree, ancestors, descendants) funnels through.
 * No DB: contexts are constructed directly.
 */
describe('VisibilityResolver', () => {
  // filterPersons/isVisible/redact never touch the injected deps.
  const resolver = new VisibilityResolver(
    undefined as never,
    undefined as never,
    undefined as never,
  );

  const settings = (over: Partial<VisibilitySettings> = {}): VisibilitySettings =>
    ({
      tenantId: 't',
      level: 'members',
      womenDisplay: 'with_siblings',
      showPhotos: true,
      showPhones: false,
      showBirthDates: true,
      showDeceased: true,
      showMinors: true,
      showDocuments: false,
      defaultMemberScope: 'tribe',
      requireIdForViewRequest: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    }) as VisibilitySettings;

  const person = (over: Partial<Person> = {}): Person =>
    ({
      id: 'p',
      gender: 'male',
      isDeceased: false,
      birthDate: null,
      tribalUnitId: null,
      fatherId: null,
      motherId: null,
      photoKey: 'photos/x.jpg',
      ...over,
    }) as Person;

  const ctx = (over: Partial<ViewerContext> = {}): ViewerContext => ({
    bypassPolicies: false,
    scope: 'tribe',
    unitIds: new Set<string>(),
    directPersonIds: new Set<string>(),
    settings: settings(),
    ...over,
  });

  describe('women-hidden', () => {
    const hidden = () => ctx({ settings: settings({ womenDisplay: 'hidden' }) });

    it('removes a female from a non-direct-relative viewer (list/search/tree parity)', () => {
      const male = person({ id: 'm', gender: 'male' });
      const female = person({ id: 'f', gender: 'female' });
      const out = resolver.filterPersons(hidden(), [male, female]);
      expect(out.map((p) => p.id)).toEqual(['m']);
    });

    it('keeps a female who IS a direct relative', () => {
      const female = person({ id: 'f', gender: 'female' });
      const c = ctx({
        settings: settings({ womenDisplay: 'hidden' }),
        directPersonIds: new Set(['f']),
      });
      expect(resolver.filterPersons(c, [female]).map((p) => p.id)).toEqual(['f']);
    });

    it('admins (bypass) still see women', () => {
      const female = person({ id: 'f', gender: 'female' });
      const c = ctx({ bypassPolicies: true, settings: settings({ womenDisplay: 'hidden' }) });
      expect(resolver.filterPersons(c, [female]).map((p) => p.id)).toEqual(['f']);
    });

    it('isVisible is false for a hidden woman (the check the search path relies on)', () => {
      expect(resolver.isVisible(hidden(), person({ id: 'f', gender: 'female' }))).toBe(false);
    });
  });

  describe('scope', () => {
    it('unit scope excludes persons in other tribal units (→ 404)', () => {
      const c = ctx({ scope: 'unit', unitIds: new Set(['clanA']) });
      expect(resolver.isVisible(c, person({ tribalUnitId: 'clanA' }))).toBe(true);
      expect(resolver.isVisible(c, person({ tribalUnitId: 'clanB' }))).toBe(false);
    });

    it('direct scope only admits direct relatives', () => {
      const c = ctx({ scope: 'direct', directPersonIds: new Set(['p']) });
      expect(resolver.isVisible(c, person({ id: 'p' }))).toBe(true);
      expect(resolver.isVisible(c, person({ id: 'q' }))).toBe(false);
    });
  });

  describe('field redaction', () => {
    it('DELETES blocked keys (not null) for non-admins', () => {
      const c = ctx({ settings: settings({ showPhotos: false, showBirthDates: false }) });
      const out = resolver.redact(c, person({ photoKey: 'photos/x.jpg', birthDate: new Date() }));
      expect('photoKey' in out).toBe(false);
      expect('birthDate' in out).toBe(false);
    });

    it('keeps fields for admins', () => {
      const c = ctx({ bypassPolicies: true, settings: settings({ showPhotos: false }) });
      const out = resolver.redact(c, person({ photoKey: 'photos/x.jpg' }));
      expect(out.photoKey).toBe('photos/x.jpg');
    });
  });
});

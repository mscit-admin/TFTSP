import { buildFullName, normalizeArabic } from './arabic';

describe('normalizeArabic', () => {
  it('unifies hamza forms to bare alef', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabic('آمنة')).toBe('امنه');
  });

  it('maps ta-marbuta to ha and alef-maqsura to ya', () => {
    expect(normalizeArabic('فاطمة')).toBe('فاطمه');
    expect(normalizeArabic('يحيى')).toBe('يحيي');
  });

  it('strips tashkeel and tatweel and collapses whitespace', () => {
    expect(normalizeArabic('مُحَمَّد')).toBe('محمد');
    expect(normalizeArabic('عـــلي')).toBe('علي');
    expect(normalizeArabic('  علي   حسن  ')).toBe('علي حسن');
  });
});

describe('buildFullName', () => {
  it('joins the present name parts with single spaces', () => {
    expect(buildFullName({ firstName: 'محمد', fatherName: 'أحمد', familyName: 'الهلالي' })).toBe(
      'محمد أحمد الهلالي',
    );
  });

  it('skips empty/undefined parts', () => {
    expect(buildFullName({ firstName: 'محمد', fatherName: null, grandfatherName: '' })).toBe(
      'محمد',
    );
  });
});

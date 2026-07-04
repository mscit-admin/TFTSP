import { Prisma } from '@prisma/client';

/**
 * TypeScript mirror of the SQL `name_normalized` generated column (Spec §8):
 * hamza forms -> ا, ة -> ه, ى -> ي, strip tatweel + tashkeel, collapse spaces.
 * Kept identical to the DB expression so tests and display logic agree.
 */
export function normalizeArabic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ـًٌٍَُِّْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** SQL fragment applying the SAME normalization to a bound value (for raw search). */
export function normalizedSql(value: string): Prisma.Sql {
  return Prisma.sql`btrim(regexp_replace(translate(lower(${value}), ${'أإآٱىةـًٌٍَُِّْ'}, ${'اااايه'}), ${'\\s+'}, ${' '}, ${'g'}))`;
}

/** Builds the display full name from the name parts (Spec §5). */
export function buildFullName(parts: {
  firstName: string;
  fatherName?: string | null;
  grandfatherName?: string | null;
  familyName?: string | null;
}): string {
  return [parts.firstName, parts.fatherName, parts.grandfatherName, parts.familyName]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .join(' ');
}

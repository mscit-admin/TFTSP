import { ImportTemplateColumn } from './import.types';

/** BullMQ queue + job for the import parse pipeline (Spec §12). */
export const IMPORT_QUEUE = 'bulk-import';
export const JOB_PARSE = 'import-parse';

/** Socket.IO namespace + event (mirrors shared-types IMPORT_WS_EVENT). */
export const IMPORT_WS_NAMESPACE = '/imports';
export const IMPORT_WS_EVENT = 'import_progress' as const;

/** DI token so the M2 change-request publisher can delegate import-batch publish. */
export const IMPORT_BATCH_APPLIER = 'IMPORT_BATCH_APPLIER' as const;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB (Spec §12)
export const APPLY_CHUNK_SIZE = 1000; // rows per transaction on publish (Spec §12)
export const DUPLICATE_THRESHOLD = 0.6; // Spec §8

/** Official template columns (order matters). Keys from shared-types. */
export const IMPORT_TEMPLATE_COLUMNS: ImportTemplateColumn[] = [
  'rowRef',
  'fullName',
  'gender',
  'fatherRef',
  'motherRef',
  'birthDate',
  'deathDate',
  'branch',
  'clan',
  'family',
  'spouseRef',
  'laqab',
  'profession',
  'phone',
  'notes',
];

/** Bilingual headers rendered into the downloadable template. */
export const TEMPLATE_HEADERS: Record<ImportTemplateColumn, { ar: string; en: string }> = {
  rowRef: { ar: 'معرّف الصف', en: 'Row Ref' },
  fullName: { ar: 'الاسم الكامل', en: 'Full Name' },
  gender: { ar: 'الجنس (male/female)', en: 'Gender (male/female)' },
  fatherRef: { ar: 'مرجع الأب أو اسمه', en: 'Father Ref / Name' },
  motherRef: { ar: 'مرجع الأم أو اسمها', en: 'Mother Ref / Name' },
  birthDate: { ar: 'تاريخ الميلاد', en: 'Birth Date' },
  deathDate: { ar: 'تاريخ الوفاة', en: 'Death Date' },
  branch: { ar: 'الفرع', en: 'Branch' },
  clan: { ar: 'الفخذ', en: 'Clan' },
  family: { ar: 'العائلة', en: 'Family' },
  spouseRef: { ar: 'مرجع الزوج/الزوجة', en: 'Spouse Ref' },
  laqab: { ar: 'اللقب', en: 'Laqab' },
  profession: { ar: 'المهنة', en: 'Profession' },
  phone: { ar: 'الهاتف', en: 'Phone' },
  notes: { ar: 'ملاحظات', en: 'Notes' },
};

/** i18n keys for per-row/column validation errors. */
export const ROW_ERROR = {
  ROW_REF_REQUIRED: 'errors.import.row.row_ref_required',
  FULL_NAME_REQUIRED: 'errors.import.row.full_name_required',
  INVALID_GENDER: 'errors.import.row.invalid_gender',
  INVALID_DATE: 'errors.import.row.invalid_date',
  FATHER_NOT_FOUND: 'errors.import.row.father_not_found',
  MOTHER_NOT_FOUND: 'errors.import.row.mother_not_found',
  FATHER_MUST_BE_MALE: 'errors.import.row.father_must_be_male',
  MOTHER_MUST_BE_FEMALE: 'errors.import.row.mother_must_be_female',
  CYCLE: 'errors.import.row.cycle',
  AMBIGUOUS_REF: 'errors.import.row.ambiguous_ref',
} as const;

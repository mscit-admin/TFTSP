import { Readable } from 'node:stream';
import * as ExcelJS from 'exceljs';
import { parse } from 'csv-parse';
import { ImportTemplateColumn, IMPORT_TEMPLATE_COLUMN_KEYS, RawRow } from '../import.types';

export interface ParsedRow {
  rowNumber: number;
  cells: RawRow;
}

/** Map a positional cell array to the fixed template columns. */
function toRawRow(cells: Array<string | null>): RawRow {
  const row = {} as RawRow;
  IMPORT_TEMPLATE_COLUMN_KEYS.forEach((key: ImportTemplateColumn, i) => {
    const value = cells[i];
    row[key] = value === undefined || value === null || value === '' ? null : String(value).trim();
  });
  return row;
}

/**
 * Streaming xlsx reader (exceljs WorkbookReader) — constant memory regardless of
 * row count (Spec §12: 100k rows < 512 MB). Row 1 is the header and is skipped.
 */
export async function* readXlsx(stream: Readable): AsyncGenerator<ParsedRow> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
    entries: 'emit',
    worksheets: 'emit',
    sharedStrings: 'cache',
  });
  for await (const worksheet of workbook) {
    for await (const row of worksheet) {
      if (row.number === 1) {
        continue; // header
      }
      // row.values is 1-indexed (index 0 is empty).
      const values = (row.values as Array<ExcelJS.CellValue>) ?? [];
      const cells = IMPORT_TEMPLATE_COLUMN_KEYS.map((_, i) => normalizeCell(values[i + 1]));
      yield { rowNumber: row.number, cells: toRawRow(cells) };
    }
  }
}

function normalizeCell(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    // exceljs rich text / hyperlink / formula result objects.
    const obj = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (typeof obj.text === 'string') {
      return obj.text;
    }
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => r.text).join('');
    }
    if (obj.result !== undefined) {
      return String(obj.result);
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return null;
  }
  return String(value);
}

/**
 * Streaming CSV reader (csv-parse). Row 1 is the header and is skipped.
 * `from_line`/`relax_column_count` keep it forgiving for user files.
 */
export async function* readCsv(stream: Readable): AsyncGenerator<ParsedRow> {
  const parser = stream.pipe(
    parse({ relaxColumnCount: true, skipEmptyLines: true, trim: true, bom: true }),
  );
  let n = 0;
  for await (const record of parser as AsyncIterable<string[]>) {
    n += 1;
    if (n === 1) {
      continue; // header
    }
    yield { rowNumber: n, cells: toRawRow(record) };
  }
}

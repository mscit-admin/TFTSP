import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { IMPORT_TEMPLATE_COLUMNS, TEMPLATE_HEADERS } from './import.constants';

export interface TemplateFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/** Builds the official bilingual import template (Spec §12). */
@Injectable()
export class ImportTemplateService {
  private headers(lang: 'ar' | 'en'): string[] {
    return IMPORT_TEMPLATE_COLUMNS.map((col) => TEMPLATE_HEADERS[col][lang]);
  }

  async build(format: 'xlsx' | 'csv', lang: 'ar' | 'en'): Promise<TemplateFile> {
    const headers = this.headers(lang);
    // A couple of example rows demonstrating in-file refs.
    const examples =
      lang === 'ar'
        ? [
            [
              '1',
              'محمد أحمد الهلالي',
              'male',
              '',
              '',
              '1960',
              '',
              'الفرع',
              'الفخذ',
              '',
              '',
              '',
              '',
              '',
              '',
            ],
          ]
        : [
            [
              '1',
              'Mohammed Ahmad Al-Hilali',
              'male',
              '',
              '',
              '1960',
              '',
              'Branch',
              'Clan',
              '',
              '',
              '',
              '',
              '',
              '',
            ],
          ];
    const child =
      lang === 'ar'
        ? [
            [
              '2',
              'خالد محمد الهلالي',
              'male',
              'ref:1',
              '',
              '1985',
              '',
              'الفرع',
              'الفخذ',
              '',
              '',
              '',
              '',
              '',
              '',
            ],
          ]
        : [
            [
              '2',
              'Khaled Mohammed Al-Hilali',
              'male',
              'ref:1',
              '',
              '1985',
              '',
              'Branch',
              'Clan',
              '',
              '',
              '',
              '',
              '',
              '',
            ],
          ];

    if (format === 'csv') {
      const rows = [headers, ...examples, ...child].map((r) =>
        r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','),
      );
      return {
        buffer: Buffer.from('﻿' + rows.join('\n'), 'utf8'), // BOM for Excel/Arabic
        contentType: 'text/csv; charset=utf-8',
        filename: `tftsp-import-template-${lang}.csv`,
      };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Import');
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    examples.forEach((r) => sheet.addRow(r));
    child.forEach((r) => sheet.addRow(r));
    if (lang === 'ar') {
      sheet.views = [{ rightToLeft: true }];
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `tftsp-import-template-${lang}.xlsx`,
    };
  }
}

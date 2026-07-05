import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VisibilityResolver } from '../visibility/visibility.resolver';
import { LineageService } from '../lineage/lineage.service';
import { IMPORT_TEMPLATE_COLUMNS } from '../imports/import.constants';
import { PdfRenderer } from './pdf-renderer';
import { buildTreeHtml } from './tree-html';
import { ExportTreePdfDto, ExportTreePngDto } from './dto/export.dto';

export interface ExportFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

@Injectable()
export class ExportService {
  constructor(
    private readonly lineage: LineageService,
    private readonly renderer: PdfRenderer,
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityResolver,
  ) {}

  /** Build the (already visibility-filtered) tree HTML for a root. */
  async buildTreeHtml(rootId: string, generations: number, layout: string, paper: string) {
    const tree = await this.lineage.getTree(rootId, generations); // resolver-filtered
    return buildTreeHtml(
      tree.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        gender: n.gender,
        isDeceased: n.isDeceased,
      })),
      tree.edges.map((e) => ({ parentId: e.parentId, childId: e.childId })),
      { paper: paper as never, layout: layout as never },
    );
  }

  async treePdf(dto: ExportTreePdfDto): Promise<ExportFile> {
    const html = await this.buildTreeHtml(dto.rootId, dto.generations, dto.layout, dto.paper);
    const buffer = await this.renderer.renderPdf(html, dto.paper);
    return { buffer, contentType: 'application/pdf', filename: `tree-${dto.rootId}.pdf` };
  }

  async treePng(dto: ExportTreePngDto): Promise<ExportFile> {
    const html = await this.buildTreeHtml(dto.rootId, dto.generations, dto.layout, 'A4');
    const buffer = await this.renderer.renderPng(html, dto.scale);
    return { buffer, contentType: 'image/png', filename: `tree-${dto.rootId}.png` };
  }

  /** Tabular export using the import-template columns for round-trip (Spec §M4.7). */
  async persons(format: 'xlsx' | 'csv'): Promise<ExportFile> {
    const rows = await this.personRows();
    if (format === 'csv') {
      const lines = [IMPORT_TEMPLATE_COLUMNS.join(',')].concat(
        rows.map((r) =>
          IMPORT_TEMPLATE_COLUMNS.map((c) => {
            const v = r[c] ?? '';
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          }).join(','),
        ),
      );
      return {
        buffer: Buffer.from('﻿' + lines.join('\n'), 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        filename: 'persons.csv',
      };
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Persons');
    ws.addRow([...IMPORT_TEMPLATE_COLUMNS]);
    for (const r of rows) {
      ws.addRow(IMPORT_TEMPLATE_COLUMNS.map((c) => r[c] ?? ''));
    }
    return {
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'persons.xlsx',
    };
  }

  private async personRows(): Promise<Array<Record<string, string>>> {
    const ctx = await this.visibility.buildContext();
    const persons = await this.prisma.tenant.person.findMany({ where: { deletedAt: null } });
    const visible = this.visibility.filterPersons(ctx, persons);
    const units = await this.prisma.tenant.tribalUnit.findMany({
      select: { id: true, nameAr: true },
    });
    const unitName = new Map(units.map((u) => [u.id, u.nameAr]));
    const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
    return visible.map((p) => ({
      rowRef: p.id,
      fullName: p.fullName,
      gender: p.gender,
      fatherRef: p.fatherId ?? '',
      motherRef: p.motherId ?? '',
      birthDate: iso(p.birthDate),
      deathDate: iso(p.deathDate),
      branch: '',
      clan: p.tribalUnitId ? (unitName.get(p.tribalUnitId) ?? '') : '',
      family: '',
      spouseRef: '',
      laqab: p.laqab ?? '',
      profession: p.profession ?? '',
      phone: '',
      notes: '',
    }));
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { TableExportFormat } from '../models';
import { ApiService } from './api.service';

export type TreeLayout = 'vertical' | 'horizontal' | 'fan';
export type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type PngScale = 2 | 4;

export interface TreePdfRequest {
  rootId?: string;
  layout: TreeLayout;
  paper: PaperSize;
}
export interface TreePngRequest {
  rootId?: string;
  layout: TreeLayout;
  scale: PngScale;
}

/** Exports (M4 §M4.2/§M4.7): server-rendered tree PDF/PNG + tabular persons export. */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly api = inject(ApiService);

  treePdf(req: TreePdfRequest): Observable<Blob> {
    return this.api.postBlob('/exports/tree/pdf', req);
  }

  treePng(req: TreePngRequest): Observable<Blob> {
    return this.api.postBlob('/exports/tree/png', req);
  }

  persons(format: TableExportFormat): Observable<Blob> {
    return this.api.getBlob(`/exports/persons.${format}`);
  }
}

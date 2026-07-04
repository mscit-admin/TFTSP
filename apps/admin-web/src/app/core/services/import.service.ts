import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import type {
  ImportBatch,
  ImportFileFormat,
  ImportProgressEvent,
  ImportRow,
  ImportRowStatus,
  Paginated,
  SubmitImportDto,
  UpdateImportRowDto,
} from '../models';
import { IMPORT_WS_EVENT } from '../models';
import { ApiService, QueryParams } from './api.service';
import { TokenStorageService } from './token-storage.service';
import { SOCKET_URL } from '../tokens';

export interface ImportRowsQuery {
  status?: ImportRowStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Typed data service for /imports (M2.5): REST endpoints + the `/imports` Socket.IO
 * namespace for live progress. All socket wiring is confined here (rule 6) — the wizard
 * subscribes to `progress$` and never touches HttpClient or the socket directly.
 */
@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(TokenStorageService);
  private readonly socketUrl = inject(SOCKET_URL);

  private socket: Socket | null = null;
  private readonly _progress = new Subject<ImportProgressEvent>();
  /** Live parse/validate/resolve/publish progress for the active batch. */
  readonly progress$: Observable<ImportProgressEvent> = this._progress.asObservable();

  // ---- REST ----

  /** Download the official bilingual template for the current UI language. */
  downloadTemplate(format: ImportFileFormat, lang: string): Observable<Blob> {
    return this.api.getBlob('/imports/template', { format, lang });
  }

  /** Multipart upload → create batch + enqueue parse job. HttpClient sets the boundary. */
  upload(file: File, format: ImportFileFormat): Observable<ImportBatch> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('format', format);
    return this.api.post<ImportBatch>('/imports', form);
  }

  list(page = 1, pageSize = 20): Observable<Paginated<ImportBatch>> {
    return this.api.get<Paginated<ImportBatch>>('/imports', { page, pageSize });
  }

  get(id: string): Observable<ImportBatch> {
    return this.api.get<ImportBatch>(`/imports/${id}`);
  }

  rows(id: string, query: ImportRowsQuery = {}): Observable<Paginated<ImportRow>> {
    const params: QueryParams = {
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    };
    return this.api.get<Paginated<ImportRow>>(`/imports/${id}/rows`, params);
  }

  updateRow(id: string, rowId: string, dto: UpdateImportRowDto): Observable<ImportRow> {
    return this.api.patch<ImportRow>(`/imports/${id}/rows/${rowId}`, dto);
  }

  submit(id: string, dto: SubmitImportDto): Observable<ImportBatch> {
    return this.api.post<ImportBatch>(`/imports/${id}/submit`, dto);
  }

  rollback(id: string): Observable<ImportBatch> {
    return this.api.post<ImportBatch>(`/imports/${id}/rollback`);
  }

  // ---- Socket ----

  /** Open the `/imports` progress socket (idempotent). Same handshake as notifications. */
  connect(): void {
    if (this.socket) return;
    const base = this.socketUrl || '';
    this.socket = io(`${base}/imports`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: this.storage.accessToken ?? '' }),
      autoConnect: true,
    });
    this.socket.on(IMPORT_WS_EVENT, (payload: ImportProgressEvent) => this._progress.next(payload));
  }

  /** Close the socket (called when leaving the wizard / on logout). */
  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}

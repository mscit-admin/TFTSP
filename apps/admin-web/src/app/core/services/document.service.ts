import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import type {
  ConfirmUploadDto,
  DocumentWithUrl,
  PersonDocument,
  PresignedUpload,
  RequestUploadDto,
} from '../models';
import { ApiService } from './api.service';
import { SKIP_AUTH } from '../interceptors/auth.interceptor';

/**
 * Person documents (M4 §M4.3): presign → PUT to MinIO → confirm. The PUT targets an
 * external presigned URL, so it uses HttpClient directly with SKIP_AUTH (no bearer, which
 * would break the MinIO signature). All other calls go through ApiService.
 */
@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  list(personId: string): Observable<DocumentWithUrl[]> {
    return this.api.get<DocumentWithUrl[]>(`/persons/${personId}/documents`);
  }

  presign(dto: RequestUploadDto): Observable<PresignedUpload> {
    return this.api.post<PresignedUpload>('/documents/presign', dto);
  }

  confirm(dto: ConfirmUploadDto): Observable<PersonDocument> {
    return this.api.post<PersonDocument>('/documents/confirm', dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/documents/${id}`);
  }

  /**
   * Full upload: presign → PUT the raw bytes to MinIO → confirm the row.
   * The 10 MB / SVG / magic-byte checks are enforced server-side on confirm.
   */
  upload(file: File, personId: string): Observable<PersonDocument> {
    const req: RequestUploadDto = {
      personId,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    };
    return this.presign(req).pipe(
      switchMap((presigned) =>
        this.http
          .put(presigned.uploadUrl, file, {
            headers: { 'Content-Type': file.type },
            context: new HttpContext().set(SKIP_AUTH, true),
          })
          .pipe(
            switchMap(() =>
              this.confirm({ personId, objectKey: presigned.objectKey, filename: file.name }),
            ),
          ),
      ),
    );
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  ApproveViewRequestDto,
  CreateViewRequestDto,
  ViewRequest,
  ViewRequestStatus,
} from '../models';
import { ApiService } from './api.service';
import { SKIP_AUTH } from '../interceptors/auth.interceptor';

/** Response of the stubbed public ID-attachment upload (contract assumption — see DECISIONS). */
export interface IdAttachmentTicket {
  idAttachmentKey: string;
}

/**
 * Typed data service for /view-requests (M3). The public submission + optional ID upload run
 * WITHOUT auth (SKIP_AUTH context) so no bearer/refresh logic is applied on the public route.
 */
@Injectable({ providedIn: 'root' })
export class ViewRequestService {
  private readonly api = inject(ApiService);

  private publicContext(): HttpContext {
    return new HttpContext().set(SKIP_AUTH, true);
  }

  // ---- Public (unauthenticated) ----

  /** Submit a tree-view request as a non-member. Tenant identified by slug. */
  createPublic(dto: CreateViewRequestDto): Observable<ViewRequest> {
    return this.api.post<ViewRequest>('/view-requests', dto, this.publicContext());
  }

  /**
   * Optional ID-attachment upload for the public form. Stubbed to a minimal key handoff
   * (M3 contract: "minimal key handoff acceptable"); the backend enforces the requirement.
   */
  uploadIdAttachment(tenantSlug: string, file: File): Observable<IdAttachmentTicket> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('tenantSlug', tenantSlug);
    return this.api.post<IdAttachmentTicket>(
      '/view-requests/id-attachment',
      form,
      this.publicContext(),
    );
  }

  // ---- Tribe Admin ----

  list(status?: ViewRequestStatus): Observable<ViewRequest[]> {
    return this.api.get<ViewRequest[]>('/view-requests', { status });
  }

  approve(id: string, dto: ApproveViewRequestDto): Observable<ViewRequest> {
    return this.api.post<ViewRequest>(`/view-requests/${id}/approve`, dto);
  }

  reject(id: string): Observable<ViewRequest> {
    return this.api.post<ViewRequest>(`/view-requests/${id}/reject`);
  }
}

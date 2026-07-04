import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ChangeRequest,
  ChangeRequestStatus,
  CreateChangeRequestDto,
  ReviewChangeRequestDto,
  UpdateChangeRequestDto,
} from '../models';
import { ApiService, QueryParams } from './api.service';

export interface ChangeRequestQuery {
  status?: ChangeRequestStatus;
  /** requests owned by the current user */
  mine?: boolean;
  /** requests awaiting my review */
  queue?: boolean;
}

/**
 * Typed data service for /change-requests (M2). Contract assumption (D-208): the list
 * endpoint returns a plain `ChangeRequest[]` (the spec says "list" without a pagination
 * envelope, unlike /persons and /notifications).
 */
@Injectable({ providedIn: 'root' })
export class ChangeRequestService {
  private readonly api = inject(ApiService);

  list(query: ChangeRequestQuery = {}): Observable<ChangeRequest[]> {
    const params: QueryParams = {
      status: query.status,
      mine: query.mine ? true : undefined,
      queue: query.queue ? true : undefined,
    };
    return this.api.get<ChangeRequest[]>('/change-requests', params);
  }

  get(id: string): Observable<ChangeRequest> {
    return this.api.get<ChangeRequest>(`/change-requests/${id}`);
  }

  create(dto: CreateChangeRequestDto): Observable<ChangeRequest> {
    return this.api.post<ChangeRequest>('/change-requests', dto);
  }

  /** Edit the patch while draft/changes_requested (or reviewer edit if reviewerCanEdit). */
  update(id: string, dto: UpdateChangeRequestDto): Observable<ChangeRequest> {
    return this.api.patch<ChangeRequest>(`/change-requests/${id}`, dto);
  }

  submit(id: string): Observable<ChangeRequest> {
    return this.api.post<ChangeRequest>(`/change-requests/${id}/submit`);
  }

  review(id: string, dto: ReviewChangeRequestDto): Observable<ChangeRequest> {
    return this.api.post<ChangeRequest>(`/change-requests/${id}/review`, dto);
  }
}

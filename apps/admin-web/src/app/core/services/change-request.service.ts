import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type {
  ChangeRequest,
  ChangeRequestStatus,
  CreateChangeRequestDto,
  Paginated,
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
 * Typed data service for /change-requests (M2). The list endpoint returns the standard
 * `{ data, page, pageSize, total }` envelope (reconciled with the backend); we unwrap `data`
 * so callers keep working with a plain `ChangeRequest[]`.
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
    return this.api
      .get<Paginated<ChangeRequest>>('/change-requests', params)
      .pipe(map((res) => res.data));
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

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  CreatePersonDto,
  Paginated,
  Person,
  PersonQuery,
  UpdatePersonDto,
} from '../models';
import { ApiService, QueryParams } from './api.service';

/** Typed data service for /persons (Spec Section 5, API_CONTRACT Persons). */
@Injectable({ providedIn: 'root' })
export class PersonService {
  private readonly api = inject(ApiService);

  list(query: PersonQuery = {}): Observable<Paginated<Person>> {
    const params: QueryParams = {
      q: query.q,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    };
    return this.api.get<Paginated<Person>>('/persons', params);
  }

  get(id: string): Observable<Person> {
    return this.api.get<Person>(`/persons/${id}`);
  }

  /**
   * Create. If duplicate candidates (similarity >= 0.6) exist, the API rejects with
   * 409 + candidates; the caller confirms and resubmits with `confirmDuplicate: true`.
   */
  create(dto: CreatePersonDto): Observable<Person> {
    return this.api.post<Person>('/persons', dto);
  }

  /** Optimistic-lock update — `version` must match; stale version ⇒ 409 conflict. */
  update(id: string, dto: UpdatePersonDto): Observable<Person> {
    return this.api.patch<Person>(`/persons/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/persons/${id}`);
  }
}

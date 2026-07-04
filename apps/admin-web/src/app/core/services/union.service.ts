import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { CreateUnionDto, EndUnionDto, Union } from '../models';
import { ApiService } from './api.service';

/**
 * Typed data service for /unions. Included for contract completeness; a dedicated
 * unions management screen is out of admin-web M1 UI scope (marriages surface on the
 * person form only). Lifecycle endpoints follow API_CONTRACT.
 */
@Injectable({ providedIn: 'root' })
export class UnionService {
  private readonly api = inject(ApiService);

  listForPerson(personId: string): Observable<Union[]> {
    return this.api.get<Union[]>('/unions', { personId });
  }

  create(dto: CreateUnionDto): Observable<Union> {
    return this.api.post<Union>('/unions', dto);
  }

  end(id: string, dto: EndUnionDto): Observable<Union> {
    return this.api.post<Union>(`/unions/${id}/end`, dto);
  }
}

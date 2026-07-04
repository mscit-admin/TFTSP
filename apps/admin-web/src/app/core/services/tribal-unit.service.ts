import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { CreateTribalUnitDto, TribalUnit, UpdateTribalUnitDto } from '../models';
import { ApiService } from './api.service';

/** Typed data service for /tribal-units (self-referential tribe->branch->clan->family). */
@Injectable({ providedIn: 'root' })
export class TribalUnitService {
  private readonly api = inject(ApiService);

  list(): Observable<TribalUnit[]> {
    return this.api.get<TribalUnit[]>('/tribal-units');
  }

  create(dto: CreateTribalUnitDto): Observable<TribalUnit> {
    return this.api.post<TribalUnit>('/tribal-units', dto);
  }

  update(id: string, dto: UpdateTribalUnitDto): Observable<TribalUnit> {
    return this.api.patch<TribalUnit>(`/tribal-units/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/tribal-units/${id}`);
  }
}

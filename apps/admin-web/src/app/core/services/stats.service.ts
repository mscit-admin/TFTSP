import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { TribeStats } from '../models';
import { ApiService } from './api.service';

/** Tribe statistics dashboard (M4 §M4.5). Backed by hourly materialized views. */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly api = inject(ApiService);

  tribe(): Observable<TribeStats> {
    return this.api.get<TribeStats>('/stats/tribe');
  }
}

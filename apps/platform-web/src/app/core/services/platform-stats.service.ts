import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlatformDashboard } from '../models/stats.model';

/**
 * Super Admin statistics dashboard (Spec §M4.5).
 * GET /api/v1/platform/stats/dashboard → PlatformDashboard (materialized-view backed).
 */
@Injectable({ providedIn: 'root' })
export class PlatformStatsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/platform`;

  dashboard(): Observable<PlatformDashboard> {
    return this.http.get<PlatformDashboard>(`${this.base}/stats/dashboard`);
  }
}

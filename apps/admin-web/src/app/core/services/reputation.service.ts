import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ContributorReputation,
  ReputationThresholds,
  UpdateReputationThresholdsDto,
} from '../models';
import { ApiService } from './api.service';

/** Contributor reputation & thresholds (M4 §13). */
@Injectable({ providedIn: 'root' })
export class ReputationService {
  private readonly api = inject(ApiService);

  /** Current user's reputation in the active tenant. */
  me(): Observable<ContributorReputation> {
    return this.api.get<ContributorReputation>('/reputation/me');
  }

  /** Tribe Admin: contributors ranked by accuracy. */
  list(): Observable<ContributorReputation[]> {
    return this.api.get<ContributorReputation[]>('/reputation');
  }

  getThresholds(): Observable<ReputationThresholds> {
    return this.api.get<ReputationThresholds>('/reputation/thresholds');
  }

  updateThresholds(dto: UpdateReputationThresholdsDto): Observable<ReputationThresholds> {
    return this.api.patch<ReputationThresholds>('/reputation/thresholds', dto);
  }
}

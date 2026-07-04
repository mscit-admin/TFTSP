import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { UpdateWorkflowSettingsDto, WorkflowSettings } from '../models';
import { ApiService } from './api.service';

/** Typed data service for /workflow-settings (M2, Tribe Admin). */
@Injectable({ providedIn: 'root' })
export class WorkflowSettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<WorkflowSettings> {
    return this.api.get<WorkflowSettings>('/workflow-settings');
  }

  update(dto: UpdateWorkflowSettingsDto): Observable<WorkflowSettings> {
    return this.api.patch<WorkflowSettings>('/workflow-settings', dto);
  }
}

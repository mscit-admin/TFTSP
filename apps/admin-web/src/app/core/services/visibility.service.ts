import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { UpdateVisibilitySettingsDto, VisibilitySettings } from '../models';
import { ApiService } from './api.service';

/** Typed data service for /visibility-settings (M3, Tribe Admin). */
@Injectable({ providedIn: 'root' })
export class VisibilityService {
  private readonly api = inject(ApiService);

  get(): Observable<VisibilitySettings> {
    return this.api.get<VisibilitySettings>('/visibility-settings');
  }

  update(dto: UpdateVisibilitySettingsDto): Observable<VisibilitySettings> {
    return this.api.patch<VisibilitySettings>('/visibility-settings', dto);
  }
}

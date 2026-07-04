import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { LogoUploadTicket, Tenant, TribeSettingsDto } from '../models';
import { ApiService } from './api.service';

/**
 * Tribe settings (branding). Contract assumption: the active tenant is derived from
 * the JWT, so these are unscoped-by-path endpoints under /tenant. Logo upload is
 * stubbed to the API shape — request a ticket, then (M4) PUT the file to `uploadUrl`.
 */
@Injectable({ providedIn: 'root' })
export class TenantSettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<Tenant> {
    return this.api.get<Tenant>('/tenant/settings');
  }

  update(dto: TribeSettingsDto): Observable<Tenant> {
    return this.api.patch<Tenant>('/tenant/settings', dto);
  }

  /** Stub: returns a presigned upload URL + the logoKey to persist via update(). */
  requestLogoUpload(contentType: string): Observable<LogoUploadTicket> {
    return this.api.post<LogoUploadTicket>('/tenant/settings/logo-upload', { contentType });
  }
}

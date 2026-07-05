import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SetSubscriptionDto,
  SubscriptionActivation,
  TenantSubscription,
} from '../models/subscription.model';

/**
 * Typed access to the platform subscription endpoints (Super Admin).
 * `/api/v1/platform/tenants/:id/subscription`. The only place components
 * reach the subscription API.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/platform/tenants`;

  get(tenantId: string): Observable<TenantSubscription> {
    return this.http.get<TenantSubscription>(`${this.base}/${tenantId}/subscription`);
  }

  /** Assign tier / manual activation / expiry — audited server-side. */
  set(tenantId: string, dto: SetSubscriptionDto): Observable<TenantSubscription> {
    return this.http.put<TenantSubscription>(
      `${this.base}/${tenantId}/subscription`,
      dto,
    );
  }

  activations(tenantId: string): Observable<SubscriptionActivation[]> {
    return this.http.get<SubscriptionActivation[]>(
      `${this.base}/${tenantId}/subscription/activations`,
    );
  }
}

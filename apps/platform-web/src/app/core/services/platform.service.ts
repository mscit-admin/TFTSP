import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateTenantRequest,
  PlatformStats,
  TenantRow,
  TenantStatus,
} from '../models/tenant.model';

/** Raw tenant object as it may arrive from the API (casing-tolerant). */
interface RawTenant {
  id: string;
  slug: string;
  nameAr?: string;
  name_ar?: string;
  nameEn?: string;
  name_en?: string;
  status: TenantStatus;
  createdAt?: string;
  created_at?: string;
  personsCount?: number;
  persons_count?: number;
  usersCount?: number;
  users_count?: number;
  counts?: { persons?: number; users?: number };
}

/**
 * Typed data access for the platform (`/platform/*`) endpoints.
 * The only place components reach the platform API. Normalizes the
 * list response so the UI always sees canonical camelCase `TenantRow`s.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/platform`;

  listTenants(): Observable<TenantRow[]> {
    return this.http
      .get<RawTenant[] | { data: RawTenant[] }>(`${this.base}/tenants`)
      .pipe(map((res) => (Array.isArray(res) ? res : res.data).map(normalizeTenant)));
  }

  createTenant(body: CreateTenantRequest): Observable<TenantRow> {
    return this.http
      .post<RawTenant>(`${this.base}/tenants`, body)
      .pipe(map(normalizeTenant));
  }

  suspendTenant(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/tenants/${id}/suspend`, {});
  }

  activateTenant(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/tenants/${id}/activate`, {});
  }

  stats(): Observable<PlatformStats> {
    return this.http.get<PlatformStats>(`${this.base}/stats`);
  }
}

function normalizeTenant(t: RawTenant): TenantRow {
  return {
    id: t.id,
    slug: t.slug,
    nameAr: t.nameAr ?? t.name_ar ?? '',
    nameEn: t.nameEn ?? t.name_en ?? '',
    status: t.status,
    createdAt: t.createdAt ?? t.created_at,
    personsCount: t.personsCount ?? t.persons_count ?? t.counts?.persons ?? 0,
    usersCount: t.usersCount ?? t.users_count ?? t.counts?.users ?? 0,
  };
}

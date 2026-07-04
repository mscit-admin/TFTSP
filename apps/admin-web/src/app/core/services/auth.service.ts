import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import type {
  AuthUser,
  LoginDto,
  LoginResponse,
  MeResponse,
  RoleAssignment,
  TenantMembership,
  TokenPair,
} from '../models';
import { M1_WRITE_ROLES } from '../models';
import { ApiService } from './api.service';
import { TokenStorageService } from './token-storage.service';

/**
 * Session state as Angular Signals. The interceptor uses `refresh()` for silent
 * token rotation; components read `user`, `activeTenant`, `canWrite`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(TokenStorageService);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _tenants = signal<TenantMembership[]>([]);
  private readonly _activeTenant = signal<TenantMembership | null>(null);
  private readonly _roleAssignments = signal<RoleAssignment[]>([]);

  readonly user = this._user.asReadonly();
  readonly tenants = this._tenants.asReadonly();
  readonly activeTenant = this._activeTenant.asReadonly();
  readonly roleAssignments = this._roleAssignments.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);

  /** True when any current role is one of the M1 direct-write admin roles. */
  readonly canWrite = computed(() =>
    this._roleAssignments().some((ra) => M1_WRITE_ROLES.includes(ra.role)),
  );

  /** Distinct roles currently held by the user in the active tenant. */
  readonly roles = computed(() => Array.from(new Set(this._roleAssignments().map((ra) => ra.role))));

  /** Tribe Admin only — gates the workflow-settings page (M2). */
  readonly isTribeAdmin = computed(() => this.roles().includes('tribe_admin'));

  /** Can act on the review queue: Reviewers plus admin write-roles (M2). */
  readonly canReview = computed(() => this.roles().includes('reviewer') || this.canWrite());

  /** Current user id (for change-request ownership / socket rooms). */
  readonly userId = computed(() => this._user()?.id ?? null);

  /** Has a stored token — used by the guard before `me()` resolves on refresh. */
  get hasStoredSession(): boolean {
    return this.storage.accessToken !== null;
  }

  login(dto: LoginDto): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', dto).pipe(
      tap((res) => {
        this.storage.set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        this._user.set(res.user);
        this._tenants.set(res.tenants);
        this._activeTenant.set(res.tenants[0] ?? null);
      }),
    );
  }

  /** Silent refresh (rotation). Reuse of a rotated token revokes the chain server-side. */
  refresh(): Observable<TokenPair> {
    const refreshToken = this.storage.refreshToken;
    return this.api
      .post<TokenPair>('/auth/refresh', { refreshToken })
      .pipe(tap((pair) => this.storage.set(pair)));
  }

  /** Rehydrate session from the API using the stored access token (on app boot / guard). */
  loadMe(): Observable<MeResponse> {
    return this.api.get<MeResponse>('/auth/me').pipe(
      tap((me) => {
        this._user.set(me.user);
        this._roleAssignments.set(me.roleAssignments);
        if (me.activeTenant) this._activeTenant.set(me.activeTenant);
      }),
    );
  }

  setActiveTenant(tenant: TenantMembership): void {
    this._activeTenant.set(tenant);
  }

  logout(): Observable<void> {
    const refreshToken = this.storage.refreshToken;
    return this.api
      .post<void>('/auth/logout', { refreshToken })
      .pipe(tap({ next: () => this.clearSession(), error: () => this.clearSession() }));
  }

  clearSession(): void {
    this.storage.clear();
    this._user.set(null);
    this._tenants.set([]);
    this._activeTenant.set(null);
    this._roleAssignments.set([]);
  }
}

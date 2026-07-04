import { Injectable, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginDto, LoginResponse, TokenPair } from '../models/auth.model';
import { TokenStorageService } from './token-storage.service';

/**
 * Owns the Super Admin session lifecycle: login, silent refresh, logout.
 * Components never call HttpClient for auth directly — they go through here.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(TokenStorageService);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  /** Reactive: is a token present. */
  readonly isAuthenticated = computed(() => !!this.store.accessToken());
  readonly user = this.store.user;
  /** The platform guard requires this claim. */
  readonly isSuperAdmin = computed(() => !!this.store.user()?.isSuperAdmin);

  login(dto: LoginDto): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/login`, dto).pipe(
      tap((res) => {
        this.store.setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        this.store.setUser(res.user);
      }),
    );
  }

  /** Silent refresh — called by the interceptor on 401. Rotation-aware. */
  refresh(): Observable<TokenPair> {
    const refreshToken = this.store.refreshToken;
    return this.http
      .post<TokenPair>(`${this.base}/refresh`, { refreshToken })
      .pipe(tap((pair) => this.store.setTokens(pair)));
  }

  logout(): Observable<void> {
    const refreshToken = this.store.refreshToken;
    return this.http.post<void>(`${this.base}/logout`, { refreshToken }).pipe(
      tap({
        next: () => this.store.clear(),
        error: () => this.store.clear(),
      }),
    );
  }

  /** Local session teardown without a server round-trip (e.g. after refresh fails). */
  clearSession(): void {
    this.store.clear();
  }
}

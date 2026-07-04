import { Injectable, signal } from '@angular/core';
import { AuthUser, TokenPair } from '../models/auth.model';

const ACCESS_KEY = 'pw.access';
const REFRESH_KEY = 'pw.refresh';
const USER_KEY = 'pw.user';

/**
 * Persists tokens + the authenticated user across reloads.
 * Kept deliberately thin — the only place localStorage is touched.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  /** Reactive access token — components/guards read via signals (zoneless app). */
  readonly accessToken = signal<string | null>(this.read(ACCESS_KEY));
  readonly user = signal<AuthUser | null>(this.readUser());

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private readUser(): AuthUser | null {
    const raw = this.read(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  get refreshToken(): string | null {
    return this.read(REFRESH_KEY);
  }

  setTokens(pair: TokenPair): void {
    localStorage.setItem(ACCESS_KEY, pair.accessToken);
    localStorage.setItem(REFRESH_KEY, pair.refreshToken);
    this.accessToken.set(pair.accessToken);
  }

  setUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.accessToken.set(null);
    this.user.set(null);
  }
}

import { Injectable } from '@angular/core';
import type { JwtPayload, TokenPair } from '../models';

const ACCESS_KEY = 'tftsp.admin.access';
const REFRESH_KEY = 'tftsp.admin.refresh';

/** Persists the token pair. localStorage keeps the session across reloads (M1 scope). */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  set(pair: TokenPair): void {
    localStorage.setItem(ACCESS_KEY, pair.accessToken);
    localStorage.setItem(REFRESH_KEY, pair.refreshToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  /** Best-effort decode of the JWT payload (no signature verification — display/UX only). */
  decodeAccess(): JwtPayload | null {
    const token = this.accessToken;
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }

  isAccessExpired(skewSeconds = 10): boolean {
    const payload = this.decodeAccess();
    if (!payload?.exp) return false;
    return Date.now() / 1000 >= payload.exp - skewSeconds;
  }
}

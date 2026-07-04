import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';

// Shared refresh state so concurrent 401s trigger a single refresh call.
let isRefreshing = false;
const refreshed$ = new BehaviorSubject<string | null>(null);

const AUTH_FREE = ['/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * Attaches the bearer token and performs silent refresh on 401.
 * A reused/rotated refresh token ⇒ backend revokes the chain ⇒ refresh
 * itself 401s ⇒ we clear the session and bounce to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(TokenStorageService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApi = req.url.startsWith(environment.apiBaseUrl);
  const isAuthFree = AUTH_FREE.some((p) => req.url.includes(p));

  const withToken = (token: string | null) =>
    token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  const first = isApi && !isAuthFree ? withToken(store.accessToken()) : req;

  return next(first).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !isApi || isAuthFree) {
        return throwError(() => err);
      }
      return handle401(req, next, auth, store, router, withToken);
    }),
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  store: TokenStorageService,
  router: Router,
  withToken: (t: string | null) => HttpRequest<unknown>,
): Observable<HttpEvent<unknown>> {
  if (!store.refreshToken) {
    auth.clearSession();
    void router.navigate(['/login']);
    return throwError(() => new Error('errors.session_expired'));
  }

  if (isRefreshing) {
    // Queue behind the in-flight refresh, then retry with the fresh token.
    return refreshed$.pipe(
      filter((t): t is string => t !== null),
      take(1),
      switchMap((token) => next(withToken(token))),
    );
  }

  isRefreshing = true;
  refreshed$.next(null);

  return auth.refresh().pipe(
    switchMap((pair) => {
      isRefreshing = false;
      refreshed$.next(pair.accessToken);
      return next(withToken(pair.accessToken));
    }),
    catchError((refreshErr) => {
      isRefreshing = false;
      auth.clearSession();
      void router.navigate(['/login']);
      return throwError(() => refreshErr);
    }),
  );
}

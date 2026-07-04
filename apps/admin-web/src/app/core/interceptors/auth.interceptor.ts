import {
  HttpContextToken,
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
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';

/** Set on a request to opt out of bearer attach + silent refresh (auth endpoints). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

// Shared across concurrent 401s so only ONE refresh call is in flight.
let refreshing = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

function withBearer(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
}

/**
 * Attaches the bearer token and performs a single silent refresh on 401,
 * queueing concurrent requests until the new token is available. On refresh
 * failure the session is cleared and the user is routed to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorageService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const skip = req.context.get(SKIP_AUTH) || isAuthEndpoint(req.url);
  const authReq = skip ? req : withBearer(req, storage.accessToken);

  return next(authReq).pipe(
    catchError((err: unknown) => {
      const is401 = err instanceof HttpErrorResponse && err.status === 401;
      if (!is401 || skip || !storage.refreshToken) {
        return throwError(() => err);
      }
      return handle401(req, next, auth, router);
    }),
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  if (refreshing) {
    // Wait for the in-flight refresh to publish a new token, then retry once.
    return refreshedToken$.pipe(
      filter((t): t is string => t !== null),
      take(1),
      switchMap((token) => next(withBearer(req, token))),
    );
  }

  refreshing = true;
  refreshedToken$.next(null);

  return auth.refresh().pipe(
    switchMap((pair) => {
      refreshing = false;
      refreshedToken$.next(pair.accessToken);
      return next(withBearer(req, pair.accessToken));
    }),
    catchError((refreshErr: unknown) => {
      refreshing = false;
      auth.clearSession();
      void router.navigate(['/login']);
      return throwError(() => refreshErr);
    }),
  );
}

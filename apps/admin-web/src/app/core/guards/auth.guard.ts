import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Allows the route when a session is active. On a hard reload the in-memory
 * signals are empty but a token may be stored — so we rehydrate via /auth/me
 * before deciding. Failure (expired/invalid) redirects to /login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  if (auth.hasStoredSession) {
    return auth.loadMe().pipe(
      map(() => true),
      catchError(() => {
        auth.clearSession();
        return of(router.createUrlTree(['/login']));
      }),
    );
  }

  return router.createUrlTree(['/login']);
};

/** Keeps authenticated users off the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() || auth.hasStoredSession) {
    return router.createUrlTree(['/persons']);
  }
  return true;
};

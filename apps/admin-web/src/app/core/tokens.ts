import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** Base URL for the M1 REST API (`/api/v1`). Injectable so tests can override it. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

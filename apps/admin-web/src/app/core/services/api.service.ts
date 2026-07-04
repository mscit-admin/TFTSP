import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';

type ParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, ParamValue>;

/**
 * Thin typed wrapper around HttpClient. Components/services never call HttpClient
 * directly — they depend on resource services which call this (rule 7).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private toParams(params?: QueryParams): HttpParams | undefined {
    if (!params) return undefined;
    let hp = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') {
        hp = hp.set(key, String(value));
      }
    }
    return hp;
  }

  get<T>(path: string, params?: QueryParams, context?: HttpContext): Observable<T> {
    return this.http.get<T>(this.url(path), { params: this.toParams(params), context });
  }

  /** Binary download (e.g. the import template). Bearer token is attached by the interceptor. */
  getBlob(path: string, params?: QueryParams): Observable<Blob> {
    return this.http.get(this.url(path), {
      params: this.toParams(params),
      responseType: 'blob',
    });
  }

  post<T>(path: string, body?: unknown, context?: HttpContext): Observable<T> {
    return this.http.post<T>(this.url(path), body ?? {}, { context });
  }

  patch<T>(path: string, body?: unknown, context?: HttpContext): Observable<T> {
    return this.http.patch<T>(this.url(path), body ?? {}, { context });
  }

  put<T>(path: string, body?: unknown, context?: HttpContext): Observable<T> {
    return this.http.put<T>(this.url(path), body ?? {}, { context });
  }

  delete<T>(path: string, context?: HttpContext): Observable<T> {
    return this.http.delete<T>(this.url(path), { context });
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { TreeResponse } from '../models';
import { ApiService } from './api.service';

/** Typed data service for /tree (compact nodes/edges — Spec Section 7). */
@Injectable({ providedIn: 'root' })
export class TreeService {
  private readonly api = inject(ApiService);

  getTree(rootId?: string, generations = 3): Observable<TreeResponse> {
    return this.api.get<TreeResponse>('/tree', { rootId, generations });
  }
}

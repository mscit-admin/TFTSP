import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

/**
 * Per-request store carried through async calls. `tenantId` is the ONLY source
 * of truth for RLS scoping and is derived exclusively from the verified JWT —
 * never from user input (Spec Section 4.3).
 */
export interface TenantStore {
  tenantId?: string;
  userId?: string;
  isSuperAdmin: boolean;
  requestId?: string;
  ip?: string;
  /** true while inside an explicit tenant transaction so the Prisma extension
   *  does not re-wrap (which would open an illegal nested transaction). */
  inTenantTx: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * Thin wrapper over AsyncLocalStorage. Injectable so services/guards can read
 * the active tenant without threading it through every method signature.
 */
@Injectable()
export class TenantContext {
  run<T>(store: TenantStore, fn: () => T): T {
    return storage.run(store, fn);
  }

  getStore(): TenantStore | undefined {
    return storage.getStore();
  }

  get tenantId(): string | undefined {
    return storage.getStore()?.tenantId;
  }

  get userId(): string | undefined {
    return storage.getStore()?.userId;
  }

  get requestId(): string | undefined {
    return storage.getStore()?.requestId;
  }

  get ip(): string | undefined {
    return storage.getStore()?.ip;
  }

  /** Require a tenant to be bound; throws if called outside a tenant context. */
  requireTenantId(): string {
    const tenantId = this.tenantId;
    if (!tenantId) {
      throw new Error(
        'No active tenant in context (tenant-scoped code ran outside a tenant request)',
      );
    }
    return tenantId;
  }
}

export { storage as tenantStorage };

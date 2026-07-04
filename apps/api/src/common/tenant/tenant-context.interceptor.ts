import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { TenantContext, TenantStore } from './tenant-context';

/**
 * Establishes the per-request tenant context (AsyncLocalStorage) from the
 * verified JWT. Runs AFTER the auth/policy guards, so `req.user` is populated.
 * The whole handler executes inside `TenantContext.run`, so the Prisma extension
 * and every service see the correct tenant. tenant_id is derived ONLY from the
 * token (Spec §4.3).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    const store: TenantStore = {
      tenantId: user?.tenantId,
      userId: user?.id,
      isSuperAdmin: user?.isSuperAdmin ?? false,
      requestId: request.id ?? request.headers?.['x-request-id'],
      ip: request.ip ?? request.socket?.remoteAddress,
      inTenantTx: false,
    };

    // Await the handler inside run() so the ALS context stays active across the
    // entire async chain (RxJS defers execution until subscription).
    return from(this.tenantContext.run(store, () => firstValueFrom(next.handle())));
  }
}

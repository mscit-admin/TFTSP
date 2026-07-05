import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Applies the tenant-isolation extension to a base PrismaClient.
 *
 * For every model operation, when a tenant is bound in the request context and
 * we are NOT already inside an explicit tenant transaction, the query is wrapped
 * in a single transaction that first runs `SET LOCAL app.current_tenant` (via
 * set_config(..., is_local = true)). RLS policies then scope every row to that
 * tenant at the database layer. tenant_id is taken ONLY from the verified JWT
 * (Spec Section 4.3) — never from user input.
 */
export function applyTenantExtension(base: PrismaClient, tenantContext: TenantContext) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const store = tenantContext.getStore();
          const tenantId = store?.tenantId;

          // No tenant bound (platform/auth plane) or already inside a tenant
          // transaction that set the GUC: run the query as-is.
          if (!tenantId || (store?.txDepth ?? 0) > 0) {
            return query(args);
          }

          // set_config(name, value, is_local=true) == SET LOCAL, scoped to this
          // implicit transaction only.
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof applyTenantExtension>;

/** Interactive transaction client derived from the extended app client. */
export type TenantTransactionClient = Parameters<
  Parameters<ExtendedPrismaClient['$transaction']>[0]
>[0];

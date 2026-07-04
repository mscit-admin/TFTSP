import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../tenant/tenant-context';
import {
  applyTenantExtension,
  ExtendedPrismaClient,
  TenantTransactionClient,
} from './prisma.extension';

/**
 * Owns the two database planes:
 *
 *  - `tenant`  — connects as `tftsp_app` (NO BYPASSRLS). RLS-enforced, tenant
 *                scoped automatically via the extension. Use for ALL request
 *                handling of tenant data.
 *  - `platform` — connects as the owner role (bypasses non-forced RLS). Used
 *                ONLY by the trusted auth/platform plane (behind SuperAdminGuard
 *                or the pre-tenant auth flow) for cross-tenant reads/aggregates
 *                and platform tables. See DECISIONS D-101/D-102.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  private readonly appBase: PrismaClient;
  /** RLS-enforced, tenant-scoped app client. */
  readonly tenant: ExtendedPrismaClient;
  /** Trusted owner-role client (auth memberships + platform aggregates only). */
  readonly platform: PrismaClient;

  constructor(
    private readonly config: ConfigService,
    private readonly tenantContext: TenantContext,
  ) {
    const appUrl = this.config.getOrThrow<string>('DATABASE_URL');
    const ownerUrl = this.config.get<string>('DATABASE_MIGRATION_URL') ?? appUrl;

    this.appBase = new PrismaClient({ datasources: { db: { url: appUrl } } });
    this.tenant = applyTenantExtension(this.appBase, this.tenantContext);
    this.platform = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([this.appBase.$connect(), this.platform.$connect()]);
    this.logger.log('Prisma connected (app + platform planes)');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.appBase.$disconnect(), this.platform.$disconnect()]);
  }

  /**
   * Runs `fn` inside a single interactive transaction with the tenant GUC set,
   * so multi-statement work (e.g. closure-table maintenance) is atomic AND
   * RLS-scoped. The extension is told (via inTenantTx) not to re-wrap the inner
   * operations. Spec Section 5: closure maintained in the SAME transaction as
   * the person edit.
   */
  async tenantTransaction<T>(fn: (tx: TenantTransactionClient) => Promise<T>): Promise<T> {
    const store = this.tenantContext.getStore();
    const tenantId = store?.tenantId;

    return this.tenant.$transaction(async (tx) => {
      if (tenantId) {
        await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      }
      const prev = store?.inTenantTx ?? false;
      if (store) {
        store.inTenantTx = true;
      }
      try {
        return await fn(tx);
      } finally {
        if (store) {
          store.inTenantTx = prev;
        }
      }
    });
  }
}

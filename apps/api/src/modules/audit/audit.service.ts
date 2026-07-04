import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Records every tenant-scoped write (who/what/when/ip + before/after JSON diff)
 * — Spec §4.5 / §10. Writes go to the tenant-scoped audit_logs table (RLS).
 * who/ip/requestId are read from the request context, never from input.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  /** Record within an existing tenant transaction (preferred for writes). */
  async recordTx(tx: TenantTransactionClient, entry: AuditEntry): Promise<void> {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId) {
      return;
    }
    await tx.auditLog.create({ data: this.build(tenantId, entry) });
  }

  /** Record on its own (e.g. denied-access logging outside a domain transaction). */
  async record(entry: AuditEntry): Promise<void> {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId) {
      return;
    }
    try {
      await this.prisma.tenant.auditLog.create({ data: this.build(tenantId, entry) });
    } catch (err) {
      // Auditing must never break the request; log and continue.
      this.logger.error(`Failed to write audit log: ${String(err)}`);
    }
  }

  private build(tenantId: string, entry: AuditEntry): Prisma.AuditLogUncheckedCreateInput {
    return {
      tenantId,
      userId: this.tenantContext.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: (entry.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      after: (entry.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      ip: this.tenantContext.ip ?? null,
      requestId: this.tenantContext.requestId ?? null,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Person } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';
import { LineageRepository } from './lineage.repository';

export interface TreeNode {
  id: string;
  name: string;
  gender: 'male' | 'female';
  isDeceased: boolean;
  childrenCount: number;
}
export interface TreeEdge {
  parentId: string;
  childId: string;
  via: 'father';
}
export interface TreeResponse {
  nodes: TreeNode[];
  edges: TreeEdge[];
  truncated: boolean;
}

/**
 * Lineage integrity + closure maintenance. Write helpers run inside the caller's
 * tenant transaction (same transaction as the person edit — Spec §5). Read paths
 * open their own tenant transaction so raw closure SQL executes under RLS.
 */
@Injectable()
export class LineageService {
  constructor(
    private readonly repo: LineageRepository,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  // ---- write helpers (must be called within a tenant transaction) ----------

  async onCreate(
    tx: TenantTransactionClient,
    personId: string,
    fatherId: string | null,
  ): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    await this.repo.insertSelf(tx, tenantId, personId);
    if (fatherId) {
      await this.repo.moveSubtree(tx, tenantId, personId, fatherId);
    }
  }

  async onFatherChange(
    tx: TenantTransactionClient,
    personId: string,
    newFatherId: string | null,
  ): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    if (newFatherId) {
      const cycle = await this.repo.wouldCreateCycle(tx, personId, newFatherId);
      if (cycle) {
        throw AppException.badRequest(ErrorKeys.SELF_ANCESTRY, { personId, newFatherId });
      }
    }
    await this.repo.moveSubtree(tx, tenantId, personId, newFatherId);
  }

  /** Rebuild the whole tenant closure (Spec §12 rollback). Own tenant transaction. */
  async rebuildClosure(): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    await this.prisma.tenantTransaction((tx) => this.repo.rebuildForTenant(tx, tenantId));
  }

  /** Detach a soft-deleted person: its children become roots; its rows are dropped. */
  async onSoftDelete(tx: TenantTransactionClient, personId: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const children = await this.repo.directChildren(tx, personId);
    for (const child of children) {
      await tx.person.update({ where: { id: child.id }, data: { fatherId: null } });
      await this.repo.moveSubtree(tx, tenantId, child.id, null);
    }
    await this.repo.removePersonRows(tx, personId);
  }

  // ---- read paths ----------------------------------------------------------

  async getAncestors(personId: string): Promise<Person[]> {
    return this.prisma.tenantTransaction(async (tx) => {
      await this.assertPersonExists(tx, personId);
      const rows = await this.repo.ancestors(tx, personId);
      return this.loadPersonsInOrder(tx, rows);
    });
  }

  async getDescendants(personId: string): Promise<Person[]> {
    return this.prisma.tenantTransaction(async (tx) => {
      await this.assertPersonExists(tx, personId);
      const rows = await this.repo.descendants(tx, personId);
      return this.loadPersonsInOrder(tx, rows);
    });
  }

  async getTree(rootId: string, generations: number): Promise<TreeResponse> {
    return this.prisma.tenantTransaction(async (tx) => {
      const root = await this.assertPersonExists(tx, rootId);
      // Descendants within the requested generation window (+1 to detect truncation).
      const within = await this.repo.descendants(tx, rootId, generations);
      const beyond = await this.repo.descendants(tx, rootId, generations + 1);
      const truncated = beyond.length > within.length;

      const ids = [rootId, ...within.map((r) => r.id)];
      const persons = await tx.person.findMany({
        where: { id: { in: ids }, deletedAt: null },
      });
      const byId = new Map(persons.map((p) => [p.id, p]));

      // Children counts (paternal) for every returned node.
      const childCounts = await tx.person.groupBy({
        by: ['fatherId'],
        where: { fatherId: { in: ids }, deletedAt: null },
        _count: { _all: true },
      });
      const countByFather = new Map(childCounts.map((c) => [c.fatherId as string, c._count._all]));

      const nodes: TreeNode[] = [];
      const edges: TreeEdge[] = [];
      for (const id of ids) {
        const p = byId.get(id) ?? (id === rootId ? root : undefined);
        if (!p) {
          continue;
        }
        nodes.push({
          id: p.id,
          name: p.fullName,
          gender: p.gender,
          isDeceased: p.isDeceased,
          childrenCount: countByFather.get(p.id) ?? 0,
        });
        if (p.fatherId && byId.has(p.fatherId)) {
          edges.push({ parentId: p.fatherId, childId: p.id, via: 'father' });
        }
      }
      return { nodes, edges, truncated };
    });
  }

  // ---- helpers -------------------------------------------------------------

  private async assertPersonExists(tx: TenantTransactionClient, id: string): Promise<Person> {
    const person = await tx.person.findFirst({ where: { id, deletedAt: null } });
    if (!person) {
      throw AppException.notFound(ErrorKeys.PERSON_NOT_FOUND, { id });
    }
    return person;
  }

  private async loadPersonsInOrder(
    tx: TenantTransactionClient,
    rows: Array<{ id: string; depth: number }>,
  ): Promise<Person[]> {
    if (rows.length === 0) {
      return [];
    }
    const persons = await tx.person.findMany({
      where: { id: { in: rows.map((r) => r.id) }, deletedAt: null },
    });
    const byId = new Map(persons.map((p) => [p.id, p]));
    return rows.map((r) => byId.get(r.id)).filter((p): p is Person => p !== undefined);
  }
}

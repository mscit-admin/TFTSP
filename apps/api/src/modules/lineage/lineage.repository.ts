import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantTransactionClient } from '../../common/prisma/prisma.extension';

/**
 * Closure-table maintenance (Spec §5). Every method takes the active tenant
 * transaction client so the work is atomic AND RLS-scoped in the SAME
 * transaction as the person row change. Closure is PATERNAL (father_id edges) —
 * the نسب genealogy tree (see DECISIONS D-103). depth 0 = self.
 */
@Injectable()
export class LineageRepository {
  /** Insert the depth-0 self row for a new person. */
  insertSelf(tx: TenantTransactionClient, tenantId: string, personId: string): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO person_closures (tenant_id, ancestor_id, descendant_id, depth)
      VALUES (${tenantId}::uuid, ${personId}::uuid, ${personId}::uuid, 0)
    `;
  }

  /**
   * Rebuild the entire paternal closure for one tenant from live persons
   * (Spec §5 / §12 rollback). Wipes and re-derives via a recursive father walk.
   * Run inside a tenant transaction (RLS-scoped).
   */
  async rebuildForTenant(tx: TenantTransactionClient, tenantId: string): Promise<void> {
    await tx.$executeRaw`DELETE FROM person_closures WHERE tenant_id = ${tenantId}::uuid`;
    // self rows for every live person
    await tx.$executeRaw`
      INSERT INTO person_closures (tenant_id, ancestor_id, descendant_id, depth)
      SELECT ${tenantId}::uuid, id, id, 0
      FROM persons
      WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL
    `;
    // ancestor rows via recursive father chain
    await tx.$executeRaw`
      WITH RECURSIVE anc AS (
        SELECT p.id AS descendant_id, p.father_id AS ancestor_id, 1 AS depth
        FROM persons p
        WHERE p.tenant_id = ${tenantId}::uuid AND p.deleted_at IS NULL AND p.father_id IS NOT NULL
        UNION ALL
        SELECT a.descendant_id, parent.father_id, a.depth + 1
        FROM anc a
        JOIN persons parent ON parent.id = a.ancestor_id AND parent.deleted_at IS NULL
        WHERE parent.father_id IS NOT NULL
      )
      INSERT INTO person_closures (tenant_id, ancestor_id, descendant_id, depth)
      SELECT ${tenantId}::uuid, a.ancestor_id, a.descendant_id, a.depth
      FROM anc a
      JOIN persons anc_p ON anc_p.id = a.ancestor_id AND anc_p.deleted_at IS NULL
    `;
  }

  /** True if candidateAncestorId is already a descendant of personId (would create a cycle). */
  async wouldCreateCycle(
    tx: TenantTransactionClient,
    personId: string,
    candidateAncestorId: string,
  ): Promise<boolean> {
    if (personId === candidateAncestorId) {
      return true;
    }
    const rows = await tx.$queryRaw<Array<{ one: number }>>`
      SELECT 1 AS one
      FROM person_closures
      WHERE ancestor_id = ${personId}::uuid AND descendant_id = ${candidateAncestorId}::uuid
      LIMIT 1
    `;
    return rows.length > 0;
  }

  /**
   * Move the subtree rooted at personId under newFatherId (or detach to a root
   * when newFatherId is null). Classic closure-table move: strip links from the
   * subtree to its former ancestors, then graft onto the new super-tree.
   */
  async moveSubtree(
    tx: TenantTransactionClient,
    tenantId: string,
    personId: string,
    newFatherId: string | null,
  ): Promise<void> {
    // A) Remove links from every node in the subtree to any ancestor OUTSIDE it.
    await tx.$executeRaw`
      DELETE FROM person_closures
      WHERE descendant_id IN (
              SELECT descendant_id FROM person_closures WHERE ancestor_id = ${personId}::uuid
            )
        AND ancestor_id NOT IN (
              SELECT descendant_id FROM person_closures WHERE ancestor_id = ${personId}::uuid
            )
    `;

    // B) Graft onto the new father's ancestor chain (skipped for a root).
    if (newFatherId) {
      await tx.$executeRaw`
        INSERT INTO person_closures (tenant_id, ancestor_id, descendant_id, depth)
        SELECT ${tenantId}::uuid, super.ancestor_id, sub.descendant_id, super.depth + sub.depth + 1
        FROM person_closures AS super
        CROSS JOIN person_closures AS sub
        WHERE super.descendant_id = ${newFatherId}::uuid
          AND sub.ancestor_id = ${personId}::uuid
      `;
    }
  }

  /** Direct children (paternal) of a person that are not soft-deleted. */
  async directChildren(
    tx: TenantTransactionClient,
    personId: string,
  ): Promise<Array<{ id: string }>> {
    return tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM persons WHERE father_id = ${personId}::uuid AND deleted_at IS NULL
    `;
  }

  /** Remove all closure rows that reference this person (used on hard detach). */
  async removePersonRows(tx: TenantTransactionClient, personId: string): Promise<void> {
    await tx.$executeRaw`
      DELETE FROM person_closures
      WHERE ancestor_id = ${personId}::uuid OR descendant_id = ${personId}::uuid
    `;
  }

  ancestors(
    tx: TenantTransactionClient | Prisma.TransactionClient,
    personId: string,
  ): Promise<Array<{ id: string; depth: number }>> {
    return (tx as TenantTransactionClient).$queryRaw<Array<{ id: string; depth: number }>>`
      SELECT c.ancestor_id AS id, c.depth
      FROM person_closures c
      JOIN persons p ON p.id = c.ancestor_id
      WHERE c.descendant_id = ${personId}::uuid AND c.depth > 0 AND p.deleted_at IS NULL
      ORDER BY c.depth ASC
    `;
  }

  descendants(
    tx: TenantTransactionClient,
    personId: string,
    maxDepth?: number,
  ): Promise<Array<{ id: string; depth: number }>> {
    if (maxDepth !== undefined) {
      return tx.$queryRaw<Array<{ id: string; depth: number }>>`
        SELECT c.descendant_id AS id, c.depth
        FROM person_closures c
        JOIN persons p ON p.id = c.descendant_id
        WHERE c.ancestor_id = ${personId}::uuid
          AND c.depth > 0 AND c.depth <= ${maxDepth} AND p.deleted_at IS NULL
        ORDER BY c.depth ASC
      `;
    }
    return tx.$queryRaw<Array<{ id: string; depth: number }>>`
      SELECT c.descendant_id AS id, c.depth
      FROM person_closures c
      JOIN persons p ON p.id = c.descendant_id
      WHERE c.ancestor_id = ${personId}::uuid AND c.depth > 0 AND p.deleted_at IS NULL
      ORDER BY c.depth ASC
    `;
  }
}

import { Injectable } from '@nestjs/common';
import { Person, Role, VisibilitySettings } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { VisibilitySettingsService } from './visibility-settings.service';

type ScopeKind = 'tribe' | 'unit' | 'direct' | 'none';

export interface ViewerContext {
  /** admin roles bypass field redaction + women/deceased/minor existence policies. */
  bypassPolicies: boolean;
  scope: ScopeKind;
  /** tribal-unit subtree ids for scope=unit (clan/branch). */
  unitIds: Set<string>;
  /** direct relatives of the viewer's anchor person(s) — for scope=direct + women-hidden. */
  directPersonIds: Set<string>;
  settings: VisibilitySettings;
}

/** Minimal fields the resolver needs to decide visibility. */
type PersonLike = Pick<
  Person,
  'id' | 'gender' | 'isDeceased' | 'birthDate' | 'tribalUnitId' | 'fatherId' | 'motherId'
>;

const ADMIN_FULL: Role[] = [Role.tribe_admin, Role.deputy_admin];

/**
 * THE security heart of M3 (Spec §3·M3.1). Every person read passes through here.
 * Existence policies remove a person entirely (→ 404 / absent from lists); field
 * policies DELETE keys from the projection (never null). Nothing may bypass it.
 */
@Injectable()
export class VisibilityResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly settings: VisibilitySettingsService,
  ) {}

  // ---- context ------------------------------------------------------------

  async buildContext(): Promise<ViewerContext> {
    const settings = await this.settings.get();
    const store = this.tenantContext.getStore();
    if (store?.isSuperAdmin) {
      return this.ctx(true, 'tribe', new Set(), new Set(), settings);
    }

    const userId = this.tenantContext.userId;
    const tenantId = this.tenantContext.tenantId;
    if (!userId || !tenantId) {
      return this.ctx(false, 'none', new Set(), new Set(), settings);
    }

    const now = new Date();
    const assignments = await this.prisma.platform.roleAssignment.findMany({
      where: {
        tenantId,
        userId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
    });
    if (assignments.length === 0) {
      return this.ctx(false, 'none', new Set(), new Set(), settings);
    }

    let bypassPolicies = false;
    let anyTribe = false;
    let anyUnit = false;
    let anyDirect = false;
    const unitAnchors: string[] = [];
    const personAnchors: string[] = [];

    for (const a of assignments) {
      if (a.anchorPersonId) {
        personAnchors.push(a.anchorPersonId);
      }
      if (ADMIN_FULL.includes(a.role)) {
        bypassPolicies = true;
        anyTribe = true;
      } else if (a.role === Role.branch_admin) {
        bypassPolicies = true;
        anyUnit = true;
        if (a.tribalUnitId) {
          unitAnchors.push(a.tribalUnitId);
        }
      } else {
        const ms = a.memberScope ?? settings.defaultMemberScope;
        if (ms === 'tribe') {
          anyTribe = true;
        } else if (ms === 'branch' || ms === 'clan') {
          anyUnit = true;
          if (a.tribalUnitId) {
            unitAnchors.push(a.tribalUnitId);
          }
        } else {
          anyDirect = true;
        }
      }
    }

    let scope: ScopeKind = 'none';
    let unitIds = new Set<string>();
    if (anyTribe) {
      scope = 'tribe';
    } else if (anyUnit) {
      scope = 'unit';
      unitIds = await this.expandSubtrees(unitAnchors);
    } else if (anyDirect) {
      scope = 'direct';
    }

    // `admin` baseline level blocks everyone who isn't an admin role.
    if (settings.level === 'admin' && !bypassPolicies) {
      scope = 'none';
    }

    let directPersonIds = new Set<string>();
    const needDirect =
      !bypassPolicies && (scope === 'direct' || settings.womenDisplay === 'hidden');
    if (needDirect && personAnchors.length > 0) {
      directPersonIds = await this.computeDirectRelatives(personAnchors);
    }

    return this.ctx(bypassPolicies, scope, unitIds, directPersonIds, settings);
  }

  // ---- projections --------------------------------------------------------

  /** Filter a list to viewable persons and redact each (list/search/lineage). */
  filterPersons<T extends Person>(ctx: ViewerContext, persons: T[]): T[] {
    return persons.filter((p) => this.isVisible(ctx, p)).map((p) => this.redact(ctx, p));
  }

  /** Single-entity resolve — null ⇒ caller must 404 (existence not leaked). */
  resolveOne<T extends Person>(ctx: ViewerContext, person: T | null): T | null {
    if (!person || !this.isVisible(ctx, person)) {
      return null;
    }
    return this.redact(ctx, person);
  }

  /** True if the viewer may see this person at all (existence gate). */
  isVisible(ctx: ViewerContext, person: PersonLike): boolean {
    if (!this.inScope(ctx, person)) {
      return false;
    }
    if (ctx.bypassPolicies) {
      return true;
    }
    const s = ctx.settings;
    if (!s.showDeceased && person.isDeceased) {
      return false;
    }
    if (!s.showMinors && this.isMinor(person.birthDate)) {
      return false;
    }
    if (
      s.womenDisplay === 'hidden' &&
      person.gender === 'female' &&
      !ctx.directPersonIds.has(person.id)
    ) {
      return false;
    }
    return true;
  }

  /** Remove blocked FIELD keys from a person (never null). Assumes already visible. */
  redact<T extends Person>(ctx: ViewerContext, person: T): T {
    if (ctx.bypassPolicies) {
      return person;
    }
    const p: Record<string, unknown> = { ...person };
    if (!ctx.settings.showPhotos) {
      delete p.photoKey;
    }
    if (!ctx.settings.showBirthDates) {
      delete p.birthDate;
    }
    // showPhones / showDocuments have no M1 Person column yet (see DECISIONS D-308).
    return p as unknown as T;
  }

  // ---- internals ----------------------------------------------------------

  private inScope(ctx: ViewerContext, person: PersonLike): boolean {
    switch (ctx.scope) {
      case 'tribe':
        return true;
      case 'unit':
        return !!person.tribalUnitId && ctx.unitIds.has(person.tribalUnitId);
      case 'direct':
        return ctx.directPersonIds.has(person.id);
      default:
        return false;
    }
  }

  private isMinor(birthDate: Date | null): boolean {
    if (!birthDate) {
      return false;
    }
    const eighteen = new Date();
    eighteen.setFullYear(eighteen.getFullYear() - 18);
    return birthDate > eighteen;
  }

  private async expandSubtrees(anchorUnitIds: string[]): Promise<Set<string>> {
    if (anchorUnitIds.length === 0) {
      return new Set();
    }
    const units = await this.prisma.tenant.tribalUnit.findMany({
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const u of units) {
      if (u.parentId) {
        childrenByParent.set(u.parentId, [...(childrenByParent.get(u.parentId) ?? []), u.id]);
      }
    }
    const result = new Set<string>();
    const queue = [...anchorUnitIds];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (result.has(id)) {
        continue;
      }
      result.add(id);
      queue.push(...(childrenByParent.get(id) ?? []));
    }
    return result;
  }

  private async computeDirectRelatives(anchorIds: string[]): Promise<Set<string>> {
    const result = new Set<string>(anchorIds);

    // Direct ancestors via the closure table.
    const ancestors = await this.prisma.tenant.personClosure.findMany({
      where: { descendantId: { in: anchorIds } },
      select: { ancestorId: true },
    });
    ancestors.forEach((a) => result.add(a.ancestorId));

    // Children of the anchors.
    const children = await this.prisma.tenant.person.findMany({
      where: { OR: [{ fatherId: { in: anchorIds } }, { motherId: { in: anchorIds } }] },
      select: { id: true },
    });
    children.forEach((c) => result.add(c.id));

    // Siblings — persons sharing a parent with an anchor.
    const anchors = await this.prisma.tenant.person.findMany({
      where: { id: { in: anchorIds } },
      select: { fatherId: true, motherId: true },
    });
    const parentIds = [
      ...new Set(anchors.flatMap((a) => [a.fatherId, a.motherId]).filter((x): x is string => !!x)),
    ];
    if (parentIds.length > 0) {
      const siblings = await this.prisma.tenant.person.findMany({
        where: { OR: [{ fatherId: { in: parentIds } }, { motherId: { in: parentIds } }] },
        select: { id: true },
      });
      siblings.forEach((s) => result.add(s.id));
    }
    return result;
  }

  private ctx(
    bypassPolicies: boolean,
    scope: ScopeKind,
    unitIds: Set<string>,
    directPersonIds: Set<string>,
    settings: VisibilitySettings,
  ): ViewerContext {
    return { bypassPolicies, scope, unitIds, directPersonIds, settings };
  }
}

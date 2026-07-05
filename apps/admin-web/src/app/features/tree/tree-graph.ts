import * as d3 from 'd3';
import type { TreeEdge, TreeNode } from '../../core/models';

export type TreeLayoutKind = 'vertical' | 'horizontal' | 'fan';

export interface RenderNode {
  id: string;
  name: string;
  gender: 'male' | 'female';
  isDeceased: boolean;
  depth: number;
  sx: number;
  sy: number;
  isLeaf: boolean;
  collapsed: boolean;
}
export interface RenderLink {
  sourceId: string;
  targetId: string;
  path: string;
}

const NODE_R = 20;
const H_GAP = 64; // breadth gap
const V_GAP = 120; // depth gap
const VIRTUAL_ROOT = '__root__';

/** Above this many visible nodes we render on Canvas with LOD; below, SVG (Spec §7). */
export const CANVAS_THRESHOLD = 1500;

/**
 * Pure layout engine over the compact `{nodes, edges}` feed. Builds a strict hierarchy
 * (father edge is the structural parent, mother edge is the fallback), applies a d3 tree
 * or radial layout, mirrors for RTL, and returns positioned nodes/links plus bounds.
 * Rendering (SVG vs Canvas) and zoom live in the component.
 */
export class TreeGraph {
  private nodeMap = new Map<string, TreeNode>();
  private edges: TreeEdge[] = [];

  merge(resp: { nodes: TreeNode[]; edges: TreeEdge[] }): void {
    for (const n of resp.nodes) this.nodeMap.set(n.id, n);
    const seen = new Set(this.edges.map((e) => `${e.parentId}>${e.childId}`));
    for (const e of resp.edges) {
      const k = `${e.parentId}>${e.childId}`;
      if (!seen.has(k)) {
        this.edges.push(e);
        seen.add(k);
      }
    }
  }

  reset(): void {
    this.nodeMap.clear();
    this.edges = [];
  }

  get size(): number {
    return this.nodeMap.size;
  }

  /** structural parent for each node (father preferred, mother fallback). */
  private parentOf(): Map<string, string> {
    const parent = new Map<string, string>();
    for (const e of this.edges) {
      if (e.via === 'father') parent.set(e.childId, e.parentId);
    }
    for (const e of this.edges) {
      if (e.via === 'mother' && !parent.has(e.childId)) parent.set(e.childId, e.parentId);
    }
    return parent;
  }

  private childrenOf(): Map<string, string[]> {
    const parent = this.parentOf();
    const kids = new Map<string, string[]>();
    for (const [child, par] of parent) {
      if (!kids.has(par)) kids.set(par, []);
      kids.get(par)!.push(child);
    }
    return kids;
  }

  /**
   * Compute positioned nodes/links. `collapsed` hides subtrees; `rtl` mirrors branch
   * direction. Returns bounds for fit-to-view.
   */
  layout(
    kind: TreeLayoutKind,
    collapsed: Set<string>,
    rtl: boolean,
  ): { nodes: RenderNode[]; links: RenderLink[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } } {
    const kids = this.childrenOf();
    const parent = this.parentOf();
    const roots = [...this.nodeMap.keys()].filter((id) => !parent.has(id));

    interface D { id: string; children?: D[] }
    const build = (id: string): D => ({
      id,
      children: collapsed.has(id) ? undefined : (kids.get(id) ?? []).map(build),
    });
    const rootData: D = { id: VIRTUAL_ROOT, children: roots.map(build) };

    const root = d3.hierarchy<D>(rootData, (d) => d.children);
    const sign = rtl ? -1 : 1;
    const out: RenderNode[] = [];
    const posById = new Map<string, { x: number; y: number }>();

    if (kind === 'fan') {
      const maxDepth = Math.max(1, root.height);
      const radius = maxDepth * V_GAP;
      d3.tree<D>().size([2 * Math.PI, radius]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth || 1)(root);
      root.each((n) => {
        if (n.data.id === VIRTUAL_ROOT) return;
        const angle = rtl ? 2 * Math.PI - (n.x ?? 0) : (n.x ?? 0);
        const [px, py] = d3.pointRadial(angle, n.y ?? 0);
        posById.set(n.data.id, { x: px, y: py });
      });
    } else {
      d3.tree<D>().nodeSize(kind === 'vertical' ? [H_GAP, V_GAP] : [H_GAP, V_GAP])(root);
      root.each((n) => {
        if (n.data.id === VIRTUAL_ROOT) return;
        const bx = n.x ?? 0;
        const by = n.y ?? 0;
        const pos = kind === 'vertical' ? { x: bx * sign, y: by } : { x: by * sign, y: bx };
        posById.set(n.data.id, pos);
      });
    }

    root.each((n) => {
      if (n.data.id === VIRTUAL_ROOT) return;
      const meta = this.nodeMap.get(n.data.id)!;
      const p = posById.get(n.data.id)!;
      const childCount = (kids.get(n.data.id) ?? []).length;
      out.push({
        id: n.data.id,
        name: meta.name ?? '',
        gender: meta.gender ?? 'male',
        isDeceased: meta.isDeceased ?? false,
        depth: n.depth,
        sx: p.x,
        sy: p.y,
        isLeaf: childCount === 0,
        collapsed: collapsed.has(n.data.id) && childCount > 0,
      });
    });

    const links: RenderLink[] = [];
    root.each((n) => {
      if (n.data.id === VIRTUAL_ROOT || !n.parent || n.parent.data.id === VIRTUAL_ROOT) return;
      const s = posById.get(n.parent.data.id)!;
      const t = posById.get(n.data.id)!;
      links.push({ sourceId: n.parent.data.id, targetId: n.data.id, path: linkPath(kind, s, t) });
    });

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of out) {
      minX = Math.min(minX, n.sx);
      minY = Math.min(minY, n.sy);
      maxX = Math.max(maxX, n.sx);
      maxY = Math.max(maxY, n.sy);
    }
    if (!Number.isFinite(minX)) {
      minX = minY = 0;
      maxX = maxY = 1;
    }
    return { nodes: out, links, bounds: { minX, minY, maxX, maxY } };
  }

  /** ids on the path from `id` up to its root (inclusive). */
  ancestorsOf(id: string): string[] {
    const parent = this.parentOf();
    const chain: string[] = [];
    let cur: string | undefined = id;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      chain.push(cur);
      guard.add(cur);
      cur = parent.get(cur);
    }
    return chain;
  }

  /** lineage path between two people: a → LCA → b (node ids). */
  pathBetween(a: string, b: string): string[] {
    const aChain = this.ancestorsOf(a);
    const bChain = this.ancestorsOf(b);
    const bSet = new Set(bChain);
    const lca = aChain.find((id) => bSet.has(id));
    if (!lca) return [...new Set([...aChain, ...bChain])];
    const aPart = aChain.slice(0, aChain.indexOf(lca) + 1);
    const bPart = bChain.slice(0, bChain.indexOf(lca));
    return [...aPart, ...bPart];
  }

  findByName(query: string): string | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    for (const n of this.nodeMap.values()) {
      if ((n.name ?? '').toLowerCase().includes(q)) return n.id;
    }
    return null;
  }
}

function linkPath(
  kind: TreeLayoutKind,
  s: { x: number; y: number },
  t: { x: number; y: number },
): string {
  if (kind === 'vertical') {
    const my = (s.y + t.y) / 2;
    return `M${s.x},${s.y} C${s.x},${my} ${t.x},${my} ${t.x},${t.y}`;
  }
  if (kind === 'horizontal') {
    const mx = (s.x + t.x) / 2;
    return `M${s.x},${s.y} C${mx},${s.y} ${mx},${t.y} ${t.x},${t.y}`;
  }
  // fan: straight radial segment
  return `M${s.x},${s.y} L${t.x},${t.y}`;
}

export { NODE_R };

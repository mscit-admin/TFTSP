import { Component, computed, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TreeService } from '../../core/services/tree.service';
import { LanguageService } from '../../core/services/language.service';
import type { TreeResponse } from '../../core/models';

interface PositionedNode {
  id: string;
  name: string;
  gender: 'male' | 'female';
  isDeceased: boolean;
  x: number;
  y: number;
}
interface PositionedEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const COL = 150;
const ROW = 110;
const R = 26;
const PAD = 40;

/**
 * Minimal vertical SVG tree from GET /tree (nodes/edges). Deliberately basic for M1
 * (see DECISIONS D-206): no canvas / LOD / lazy-expansion — that is the rich
 * d3 renderer deferred to M4. Direction mirrors with the UI language.
 */
@Component({
  selector: 'app-tree-view',
  standalone: true,
  imports: [SlicePipe, TranslatePipe, ButtonModule, MessageModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'tree.title' | translate }}</h1>
        <p-button
          icon="pi pi-refresh"
          [label]="'tree.reload' | translate"
          size="small"
          [text]="true"
          (onClick)="reload()"
        />
      </div>

      <p-message severity="info" [text]="'tree.m1Notice' | translate" />

      @if (loading()) {
        <p class="text-gray-400">{{ 'common.loading' | translate }}</p>
      } @else if (nodes().length === 0) {
        <p class="text-gray-400">{{ 'tree.empty' | translate }}</p>
      } @else {
        <div class="overflow-auto rounded-lg border border-gray-200 bg-white p-2">
          <svg
            [attr.width]="width()"
            [attr.height]="height()"
            [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
            role="img"
          >
            @for (e of edges(); track $index) {
              <line
                [attr.x1]="e.x1"
                [attr.y1]="e.y1"
                [attr.x2]="e.x2"
                [attr.y2]="e.y2"
                stroke="#cbd5e1"
                stroke-width="1.5"
              />
            }
            @for (n of nodes(); track n.id) {
              <g [attr.transform]="'translate(' + n.x + ',' + n.y + ')'">
                <circle
                  [attr.r]="R"
                  [attr.fill]="n.gender === 'male' ? '#e0f2fe' : '#fce7f3'"
                  [attr.stroke]="n.isDeceased ? '#94a3b8' : '#0f766e'"
                  stroke-width="2"
                  [attr.stroke-dasharray]="n.isDeceased ? '4 3' : '0'"
                />
                <text
                  text-anchor="middle"
                  dy="4"
                  font-size="11"
                  fill="#1f2937"
                  [attr.direction]="lang.dir()"
                >
                  {{ n.name.length > 10 ? (n.name | slice: 0 : 9) + '…' : n.name }}
                </text>
              </g>
            }
          </svg>
        </div>
      }
    </div>
  `,
})
export class TreeViewComponent {
  private readonly treeService = inject(TreeService);
  readonly lang = inject(LanguageService);

  readonly loading = signal(true);
  private readonly raw = signal<TreeResponse | null>(null);

  private readonly layout = computed(() => this.computeLayout(this.raw()));
  readonly nodes = computed<PositionedNode[]>(() => this.layout().nodes);
  readonly edges = computed<PositionedEdge[]>(() => this.layout().edges);
  readonly width = computed(() => this.layout().width);
  readonly height = computed(() => this.layout().height);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.treeService.getTree(undefined, 3).subscribe({
      next: (res) => {
        this.raw.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.raw.set({ nodes: [], edges: [], truncated: false });
        this.loading.set(false);
      },
    });
  }

  readonly R = R;

  private computeLayout(res: TreeResponse | null): {
    nodes: PositionedNode[];
    edges: PositionedEdge[];
    width: number;
    height: number;
  } {
    if (!res || res.nodes.length === 0) {
      return { nodes: [], edges: [], width: 0, height: 0 };
    }
    // Depth via BFS from roots (nodes with no incoming father/mother edge).
    const childIds = new Set(res.edges.map((e) => e.childId));
    const roots = res.nodes.filter((n) => !childIds.has(n.id)).map((n) => n.id);
    const childrenOf = new Map<string, string[]>();
    for (const e of res.edges) {
      if (!childrenOf.has(e.parentId)) childrenOf.set(e.parentId, []);
      childrenOf.get(e.parentId)!.push(e.childId);
    }

    const depth = new Map<string, number>();
    const queue: string[] = [...(roots.length ? roots : [res.nodes[0].id])];
    for (const r of queue) depth.set(r, 0);
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      const d = depth.get(id) ?? 0;
      for (const c of childrenOf.get(id) ?? []) {
        if (!depth.has(c)) {
          depth.set(c, d + 1);
          queue.push(c);
        }
      }
    }
    // Any disconnected nodes default to depth 0.
    for (const n of res.nodes) if (!depth.has(n.id)) depth.set(n.id, 0);

    // Index within each depth for horizontal placement.
    const perDepthCount = new Map<number, number>();
    const posX = new Map<string, number>();
    const posY = new Map<string, number>();
    const maxDepth = Math.max(...[...depth.values()]);

    // Stable order: original node order.
    for (const n of res.nodes) {
      const d = depth.get(n.id)!;
      const idx = perDepthCount.get(d) ?? 0;
      perDepthCount.set(d, idx + 1);
      posX.set(n.id, idx);
      posY.set(n.id, d);
    }

    const maxCols = Math.max(...[...perDepthCount.values()]);
    const contentWidth = (maxCols - 1) * COL;
    const width = contentWidth + PAD * 2;
    const height = maxDepth * ROW + PAD * 2;
    const rtl = this.lang.isRtl();

    const nodes: PositionedNode[] = res.nodes.map((n) => {
      const col = posX.get(n.id)!;
      let x = PAD + col * COL;
      if (rtl) x = width - x; // mirror horizontally for Arabic
      const y = PAD + posY.get(n.id)! * ROW;
      return {
        id: n.id,
        // Redaction (M3) may drop display fields; tolerate absent name/gender.
        name: n.name ?? '',
        gender: n.gender ?? 'male',
        isDeceased: n.isDeceased ?? false,
        x,
        y,
      };
    });
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const edges: PositionedEdge[] = res.edges
      .map((e) => {
        const p = nodeById.get(e.parentId);
        const c = nodeById.get(e.childId);
        if (!p || !c) return null;
        return { x1: p.x, y1: p.y + R, x2: c.x, y2: c.y - R };
      })
      .filter((e): e is PositionedEdge => e !== null);

    return { nodes, edges, width, height };
  }
}

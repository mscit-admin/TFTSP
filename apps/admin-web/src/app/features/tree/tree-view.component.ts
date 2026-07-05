import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import * as d3 from 'd3';
import { TreeService } from '../../core/services/tree.service';
import { ExportService, PaperSize, PngScale } from '../../core/services/export.service';
import { LanguageService } from '../../core/services/language.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CANVAS_THRESHOLD,
  NODE_R,
  TreeGraph,
  type RenderLink,
  type RenderNode,
  type TreeLayoutKind,
} from './tree-graph';

const MALE = '#2a78d6';
const FEMALE = '#e87ba4';
const HL = '#eb6834';

@Component({
  selector: 'app-tree-view',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    SelectButtonModule,
    SelectModule,
    InputTextModule,
    MessageModule,
  ],
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'tree.title' | translate }}</h1>
        <div class="flex flex-wrap items-center gap-2">
          <p-selectbutton
            [options]="layoutOptions"
            [(ngModel)]="layout"
            optionValue="value"
            (onChange)="onLayoutChange()"
          >
            <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
          </p-selectbutton>
          <p-button icon="pi pi-refresh" [text]="true" size="small" (onClick)="reload()" />
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
        <span class="relative">
          <i class="pi pi-search absolute top-1/2 -translate-y-1/2 text-gray-400 start-2"></i>
          <input
            pInputText
            type="search"
            class="w-56 ps-8"
            [(ngModel)]="searchQuery"
            [placeholder]="'tree.search' | translate"
            (keyup.enter)="runSearch()"
          />
        </span>
        <p-button [label]="'tree.find' | translate" size="small" [text]="true" (onClick)="runSearch()" />

        <span class="mx-1 h-5 w-px bg-gray-200"></span>

        <p-button
          [label]="'tree.measure' | translate"
          [severity]="measureMode() ? 'warn' : 'secondary'"
          [text]="!measureMode()"
          size="small"
          icon="pi pi-arrows-h"
          (onClick)="toggleMeasure()"
        />
        @if (measureMode()) {
          <span class="text-xs text-gray-500">{{ 'tree.measureHint' | translate }}</span>
        }

        <span class="mx-1 h-5 w-px bg-gray-200"></span>

        <p-button icon="pi pi-search-plus" [text]="true" size="small" (onClick)="zoomBy(1.3)" />
        <p-button icon="pi pi-search-minus" [text]="true" size="small" (onClick)="zoomBy(0.77)" />
        <p-button [label]="'tree.fit' | translate" [text]="true" size="small" (onClick)="fit()" />

        <span class="mx-1 h-5 w-px bg-gray-200"></span>

        <!-- Exports -->
        <p-select
          [options]="paperOptions"
          [(ngModel)]="paper"
          optionLabel="label"
          optionValue="value"
          styleClass="w-24"
        />
        <p-button
          [label]="'tree.exportPdf' | translate"
          icon="pi pi-file-pdf"
          size="small"
          severity="secondary"
          [loading]="exporting()"
          (onClick)="exportPdf()"
        />
        <p-select
          [options]="scaleOptions"
          [(ngModel)]="scale"
          optionLabel="label"
          optionValue="value"
          styleClass="w-20"
        />
        <p-button
          [label]="'tree.exportPng' | translate"
          icon="pi pi-image"
          size="small"
          severity="secondary"
          [loading]="exporting()"
          (onClick)="exportPng()"
        />
      </div>

      @if (tooManyForSvg()) {
        <p-message severity="info" [text]="'tree.canvasMode' | translate" />
      }

      @if (loading()) {
        <p class="text-gray-400">{{ 'common.loading' | translate }}</p>
      } @else if (empty()) {
        <p class="text-gray-400">{{ 'tree.empty' | translate }}</p>
      }

      <div
        #host
        class="relative h-[70vh] w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
        [class.hidden]="loading() || empty()"
      ></div>

      <!-- Legend -->
      <div class="flex flex-wrap gap-4 text-xs text-gray-500">
        <span class="flex items-center gap-1"><span class="h-3 w-3 rounded-full" style="background:#2a78d6"></span>{{ 'persons.genderValue.male' | translate }}</span>
        <span class="flex items-center gap-1"><span class="h-3 w-3 rounded-full" style="background:#e87ba4"></span>{{ 'persons.genderValue.female' | translate }}</span>
        <span class="flex items-center gap-1"><span class="h-3 w-3 rounded-full border-2 border-dashed border-gray-400"></span>{{ 'persons.fields.isDeceased' | translate }}</span>
        <span class="flex items-center gap-1"><span class="h-3 w-3 rounded-full" style="background:#eb6834"></span>{{ 'tree.highlighted' | translate }}</span>
      </div>
    </div>
  `,
})
export class TreeViewComponent {
  private readonly treeService = inject(TreeService);
  private readonly exportService = inject(ExportService);
  private readonly lang = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  readonly loading = signal(true);
  readonly empty = signal(false);
  readonly exporting = signal(false);
  readonly measureMode = signal(false);
  readonly tooManyForSvg = signal(false);

  layout: TreeLayoutKind = 'vertical';
  searchQuery = '';
  paper: PaperSize = 'A3';
  scale: PngScale = 2;

  private readonly graph = new TreeGraph();
  private readonly collapsed = new Set<string>();
  private readonly dataVersion = signal(0);
  private readonly highlight = signal<Set<string>>(new Set());
  private pickA: string | null = null;
  private pickB: string | null = null;
  private rootId: string | undefined;

  // d3 state (imperative, kept out of signals to avoid render loops)
  private zoomBehavior?: d3.ZoomBehavior<Element, unknown>;
  private currentTransform = d3.zoomIdentity;
  private renderNodes: RenderNode[] = [];
  private renderLinks: RenderLink[] = [];

  readonly layoutOptions = [
    { value: 'vertical' as TreeLayoutKind, labelKey: 'tree.layout.vertical' },
    { value: 'horizontal' as TreeLayoutKind, labelKey: 'tree.layout.horizontal' },
    { value: 'fan' as TreeLayoutKind, labelKey: 'tree.layout.fan' },
  ];
  readonly paperOptions = (['A0', 'A1', 'A2', 'A3', 'A4'] as PaperSize[]).map((v) => ({ value: v, label: v }));
  readonly scaleOptions = ([2, 4] as PngScale[]).map((v) => ({ value: v, label: `${v}x` }));

  constructor() {
    this.reload();
    // Re-render whenever data, layout, direction or highlight change and the host exists.
    effect(() => {
      const el = this.host().nativeElement;
      this.dataVersion();
      this.highlight();
      // read direction so RTL switch re-renders
      this.lang.isRtl();
      if (!this.loading() && !this.empty()) {
        this.render(el);
      }
    });
    this.destroyRef.onDestroy(() => this.host()?.nativeElement && (this.host().nativeElement.innerHTML = ''));
  }

  reload(): void {
    this.loading.set(true);
    this.graph.reset();
    this.collapsed.clear();
    this.treeService.getTree(this.rootId, 3).subscribe({
      next: (res) => {
        this.graph.merge(res);
        this.empty.set(this.graph.size === 0);
        this.loading.set(false);
        this.dataVersion.update((v) => v + 1);
      },
      error: () => {
        this.empty.set(true);
        this.loading.set(false);
      },
    });
  }

  onLayoutChange(): void {
    this.dataVersion.update((v) => v + 1);
  }

  // ---- rendering ----

  private render(host: HTMLDivElement): void {
    const model = this.graph.layout(this.layout, this.collapsed, this.lang.isRtl());
    this.renderNodes = model.nodes;
    this.renderLinks = model.links;
    const useCanvas = model.nodes.length > CANVAS_THRESHOLD;
    this.tooManyForSvg.set(useCanvas);

    host.innerHTML = '';
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 500;

    if (useCanvas) {
      this.renderCanvas(host, w, h);
    } else {
      this.renderSvg(host, w, h);
    }
    this.fitToBounds(model.bounds, w, h);
  }

  private setupZoom(target: d3.Selection<Element, unknown, null, undefined>, onZoom: () => void): void {
    this.zoomBehavior = d3
      .zoom<Element, unknown>()
      .scaleExtent([0.05, 4])
      .on('zoom', (ev: d3.D3ZoomEvent<Element, unknown>) => {
        this.currentTransform = ev.transform;
        onZoom();
      });
    target.call(this.zoomBehavior);
  }

  private renderSvg(host: HTMLDivElement, w: number, h: number): void {
    const svg = d3
      .select(host)
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .style('cursor', 'grab');
    const g = svg.append('g');
    const hl = this.highlight();

    g.append('g')
      .selectAll('path')
      .data(this.renderLinks)
      .join('path')
      .attr('d', (d) => d.path)
      .attr('fill', 'none')
      .attr('stroke', (d) => (hl.has(d.sourceId) && hl.has(d.targetId) ? HL : '#cbd5e1'))
      .attr('stroke-width', (d) => (hl.has(d.sourceId) && hl.has(d.targetId) ? 2.5 : 1.5));

    const node = g
      .append('g')
      .selectAll('g')
      .data(this.renderNodes)
      .join('g')
      .attr('transform', (d) => `translate(${d.sx},${d.sy})`)
      .style('cursor', 'pointer')
      .on('click', (_ev: MouseEvent, d: RenderNode) => this.onNodeClick(d));

    node
      .append('circle')
      .attr('r', NODE_R)
      .attr('fill', (d) => (d.gender === 'male' ? MALE : FEMALE))
      .attr('fill-opacity', 0.18)
      .attr('stroke', (d) => (hl.has(d.id) ? HL : d.gender === 'male' ? MALE : FEMALE))
      .attr('stroke-width', (d) => (hl.has(d.id) ? 3 : 2))
      .attr('stroke-dasharray', (d) => (d.isDeceased ? '4 3' : '0'));

    node
      .filter((d) => d.collapsed)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', 14)
      .attr('fill', '#64748b')
      .text('+');

    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', NODE_R + 14)
      .attr('font-size', 11)
      .attr('fill', '#1f2937')
      .text((d) => (d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name));

    this.setupZoom(svg as unknown as d3.Selection<Element, unknown, null, undefined>, () =>
      g.attr('transform', this.currentTransform.toString()),
    );
  }

  private renderCanvas(host: HTMLDivElement, w: number, h: number): void {
    const canvas = d3
      .select(host)
      .append('canvas')
      .attr('width', w)
      .attr('height', h)
      .style('cursor', 'grab')
      .node() as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const draw = (): void => {
      const t = this.currentTransform;
      const hl = this.highlight();
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // links
      ctx.lineWidth = 1 / t.k;
      ctx.strokeStyle = '#cbd5e1';
      for (const l of this.renderLinks) {
        ctx.stroke(new Path2D(l.path));
      }
      // nodes — LOD: labels only when zoomed in enough
      const showLabels = t.k > 0.5;
      for (const n of this.renderNodes) {
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, NODE_R, 0, 2 * Math.PI);
        ctx.fillStyle = n.gender === 'male' ? MALE : FEMALE;
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = (hl.has(n.id) ? 3 : 2) / t.k;
        ctx.strokeStyle = hl.has(n.id) ? HL : n.gender === 'male' ? MALE : FEMALE;
        ctx.stroke();
        if (showLabels && n.name) {
          ctx.fillStyle = '#1f2937';
          ctx.font = `${11}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name, n.sx, n.sy + NODE_R + 12);
        }
      }
      ctx.restore();
    };

    canvas.addEventListener('click', (ev) => {
      const rect = canvas.getBoundingClientRect();
      const t = this.currentTransform;
      const gx = (ev.clientX - rect.left - t.x) / t.k;
      const gy = (ev.clientY - rect.top - t.y) / t.k;
      const hit = this.renderNodes.find((n) => Math.hypot(n.sx - gx, n.sy - gy) <= NODE_R);
      if (hit) this.onNodeClick(hit);
    });

    this.setupZoom(d3.select(canvas) as unknown as d3.Selection<Element, unknown, null, undefined>, draw);
    // stash draw so fit() can repaint
    this.canvasDraw = draw;
  }

  private canvasDraw: (() => void) | null = null;

  private fitToBounds(
    b: { minX: number; minY: number; maxX: number; maxY: number },
    w: number,
    h: number,
  ): void {
    const pad = 60;
    const bw = Math.max(1, b.maxX - b.minX) + pad * 2;
    const bh = Math.max(1, b.maxY - b.minY) + pad * 2;
    const k = Math.min(2, Math.max(0.05, Math.min(w / bw, h / bh)));
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const t = d3.zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k);
    this.applyTransform(t);
  }

  private applyTransform(t: d3.ZoomTransform): void {
    this.currentTransform = t;
    const host = this.host().nativeElement;
    const svg = host.querySelector('svg');
    const canvas = host.querySelector('canvas');
    if (this.zoomBehavior) {
      if (svg) d3.select(svg as Element).call(this.zoomBehavior.transform, t);
      if (canvas) d3.select(canvas as Element).call(this.zoomBehavior.transform, t);
    }
    if (canvas && this.canvasDraw) this.canvasDraw();
  }

  fit(): void {
    const model = this.graph.layout(this.layout, this.collapsed, this.lang.isRtl());
    const host = this.host().nativeElement;
    this.fitToBounds(model.bounds, host.clientWidth || 800, host.clientHeight || 500);
  }

  zoomBy(factor: number): void {
    this.applyTransform(this.currentTransform.scale(factor));
  }

  // ---- interactions ----

  private onNodeClick(n: RenderNode): void {
    if (this.measureMode()) {
      if (!this.pickA) {
        this.pickA = n.id;
        this.highlight.set(new Set([n.id]));
      } else if (!this.pickB && n.id !== this.pickA) {
        this.pickB = n.id;
        this.highlight.set(new Set(this.graph.pathBetween(this.pickA, this.pickB)));
      } else {
        this.pickA = n.id;
        this.pickB = null;
        this.highlight.set(new Set([n.id]));
      }
      return;
    }
    // Expand/collapse: leaves lazily fetch +2 generations.
    if (this.collapsed.has(n.id)) {
      this.collapsed.delete(n.id);
      this.dataVersion.update((v) => v + 1);
    } else if (n.isLeaf) {
      this.expand(n.id);
    } else {
      this.collapsed.add(n.id);
      this.dataVersion.update((v) => v + 1);
    }
  }

  private expand(id: string): void {
    this.treeService.getTree(id, 2).subscribe({
      next: (res) => {
        const before = this.graph.size;
        this.graph.merge(res);
        if (this.graph.size > before) this.dataVersion.update((v) => v + 1);
      },
      error: () => void 0,
    });
  }

  runSearch(): void {
    const id = this.graph.findByName(this.searchQuery);
    if (!id) {
      this.messages.add({ severity: 'info', detail: this.i18n.instant('tree.notFound') });
      return;
    }
    this.highlight.set(new Set(this.graph.ancestorsOf(id)));
    // center camera on the found node
    const node = this.renderNodes.find((n) => n.id === id);
    if (node) {
      const host = this.host().nativeElement;
      const w = host.clientWidth || 800;
      const h = host.clientHeight || 500;
      const k = Math.max(this.currentTransform.k, 0.8);
      this.applyTransform(d3.zoomIdentity.translate(w / 2 - k * node.sx, h / 2 - k * node.sy).scale(k));
    }
  }

  toggleMeasure(): void {
    this.measureMode.update((m) => !m);
    this.pickA = null;
    this.pickB = null;
    if (!this.measureMode()) this.highlight.set(new Set());
  }

  // ---- exports ----

  exportPdf(): void {
    this.exporting.set(true);
    this.exportService.treePdf({ rootId: this.rootId, layout: this.layout, paper: this.paper }).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        this.save(blob, `tree.${this.paper}.pdf`);
      },
      error: () => this.onExportError(),
    });
  }

  exportPng(): void {
    this.exporting.set(true);
    this.exportService.treePng({ rootId: this.rootId, layout: this.layout, scale: this.scale }).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        this.save(blob, `tree@${this.scale}x.png`);
      },
      error: () => this.onExportError(),
    });
  }

  private onExportError(): void {
    this.exporting.set(false);
    this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
  }

  private save(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

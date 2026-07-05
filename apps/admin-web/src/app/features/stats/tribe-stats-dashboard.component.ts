import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { StatsService } from '../../core/services/stats.service';
import type { TribeStats } from '../../core/models';

interface Bar {
  depth: number;
  count: number;
  h: number;
  x: number;
}

// Validated categorical hues (dataviz reference palette).
const MALE = '#2a78d6';
const FEMALE = '#e87ba4';
const LIVING = '#1baf7a';
const DECEASED = '#94a3b8';

@Component({
  selector: 'app-tribe-stats-dashboard',
  standalone: true,
  imports: [DatePipe, TranslatePipe, ButtonModule, MessageModule],
  template: `
    <div class="flex flex-col gap-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'dashboard.title' | translate }}</h1>
        <div class="flex items-center gap-3">
          @if (stats(); as s) {
            <span class="text-xs text-gray-400" [attr.dir]="'ltr'">
              {{ 'dashboard.refreshedAt' | translate }}: {{ s.refreshedAt | date: 'short' }}
            </span>
          }
          <p-button icon="pi pi-refresh" [text]="true" size="small" (onClick)="reload()" />
        </div>
      </div>

      @if (loading()) {
        <p class="text-gray-400">{{ 'common.loading' | translate }}</p>
      } @else if (!stats()) {
        <p-message severity="error" [text]="'errors.generic' | translate" />
      } @else if (stats(); as s) {
        <!-- Stat tiles -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          @for (t of tiles(); track t.key) {
            <div class="rounded-lg border border-gray-200 bg-white p-4">
              <div class="text-2xl font-semibold" [class]="t.class">{{ t.value }}</div>
              <div class="text-xs text-gray-500">{{ t.key | translate }}</div>
            </div>
          }
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <!-- Gender split -->
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="mb-3 text-sm font-medium text-gray-700">{{ 'dashboard.genderSplit' | translate }}</h2>
            <svg viewBox="0 0 300 40" width="100%" height="40" role="img">
              <rect [attr.x]="0" y="8" [attr.width]="malePct(s) * 3" height="20" rx="4" [attr.fill]="MALE" />
              <rect [attr.x]="malePct(s) * 3 + 2" y="8" [attr.width]="femalePct(s) * 3 - 2" height="20" rx="4" [attr.fill]="FEMALE" />
            </svg>
            <div class="mt-2 flex gap-4 text-xs text-gray-600">
              <span class="flex items-center gap-1"><span class="h-3 w-3 rounded-sm" [style.background]="MALE"></span>{{ 'persons.genderValue.male' | translate }} — {{ s.malePersons }}</span>
              <span class="flex items-center gap-1"><span class="h-3 w-3 rounded-sm" [style.background]="FEMALE"></span>{{ 'persons.genderValue.female' | translate }} — {{ s.femalePersons }}</span>
            </div>
          </div>

          <!-- Living vs deceased -->
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="mb-3 text-sm font-medium text-gray-700">{{ 'dashboard.livingDeceased' | translate }}</h2>
            <svg viewBox="0 0 300 40" width="100%" height="40" role="img">
              <rect [attr.x]="0" y="8" [attr.width]="livingPct(s) * 3" height="20" rx="4" [attr.fill]="LIVING" />
              <rect [attr.x]="livingPct(s) * 3 + 2" y="8" [attr.width]="deceasedPct(s) * 3 - 2" height="20" rx="4" [attr.fill]="DECEASED" />
            </svg>
            <div class="mt-2 flex gap-4 text-xs text-gray-600">
              <span class="flex items-center gap-1"><span class="h-3 w-3 rounded-sm" [style.background]="LIVING"></span>{{ 'dashboard.living' | translate }} — {{ s.livingPersons }}</span>
              <span class="flex items-center gap-1"><span class="h-3 w-3 rounded-sm" [style.background]="DECEASED"></span>{{ 'dashboard.deceased' | translate }} — {{ s.deceasedPersons }}</span>
            </div>
          </div>

          <!-- By generation -->
          <div class="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
            <h2 class="mb-3 text-sm font-medium text-gray-700">{{ 'dashboard.byGeneration' | translate }}</h2>
            @if (bars().length === 0) {
              <p class="text-sm text-gray-400">{{ 'dashboard.noGenerationData' | translate }}</p>
            } @else {
              <svg [attr.viewBox]="'0 0 ' + chartW() + ' 160'" width="100%" height="160" role="img">
                @for (b of bars(); track b.depth) {
                  <rect [attr.x]="b.x" [attr.y]="140 - b.h" [attr.width]="barW - 6" [attr.height]="b.h" rx="4" [attr.fill]="MALE" />
                  <text [attr.x]="b.x + (barW - 6) / 2" [attr.y]="155" text-anchor="middle" font-size="10" fill="#64748b">{{ b.depth }}</text>
                  <text [attr.x]="b.x + (barW - 6) / 2" [attr.y]="135 - b.h" text-anchor="middle" font-size="10" fill="#1f2937">{{ b.count }}</text>
                }
              </svg>
              <p class="mt-1 text-xs text-gray-400">{{ 'dashboard.generationAxis' | translate }}</p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class TribeStatsDashboardComponent {
  private readonly service = inject(StatsService);

  readonly stats = signal<TribeStats | null>(null);
  readonly loading = signal(true);

  readonly MALE = MALE;
  readonly FEMALE = FEMALE;
  readonly LIVING = LIVING;
  readonly DECEASED = DECEASED;
  readonly barW = 44;

  readonly tiles = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { key: 'dashboard.totalPersons', value: s.totalPersons, class: 'text-gray-800' },
      { key: 'dashboard.living', value: s.livingPersons, class: 'text-green-600' },
      { key: 'dashboard.deceased', value: s.deceasedPersons, class: 'text-gray-500' },
      { key: 'dashboard.generations', value: s.generations, class: 'text-sky-600' },
      { key: 'dashboard.units', value: s.unitsCount, class: 'text-indigo-600' },
      { key: 'dashboard.pendingChangeRequests', value: s.pendingChangeRequests, class: 'text-amber-600' },
      { key: 'dashboard.contributors', value: s.contributorsCount, class: 'text-tribe' },
    ];
  });

  readonly bars = computed<Bar[]>(() => {
    const s = this.stats();
    if (!s?.byGeneration?.length) return [];
    const max = Math.max(...s.byGeneration.map((g) => g.count), 1);
    return s.byGeneration.map((g, i) => ({
      depth: g.depth,
      count: g.count,
      h: Math.round((g.count / max) * 110),
      x: i * this.barW + 8,
    }));
  });

  readonly chartW = computed(() => Math.max(300, this.bars().length * this.barW + 16));

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.service.tribe().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.stats.set(null);
        this.loading.set(false);
      },
    });
  }

  private pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
  }
  malePct(s: TribeStats): number {
    return this.pct(s.malePersons, s.malePersons + s.femalePersons);
  }
  femalePct(s: TribeStats): number {
    return 100 - this.malePct(s);
  }
  livingPct(s: TribeStats): number {
    return this.pct(s.livingPersons, s.livingPersons + s.deceasedPersons);
  }
  deceasedPct(s: TribeStats): number {
    return 100 - this.livingPct(s);
  }
}

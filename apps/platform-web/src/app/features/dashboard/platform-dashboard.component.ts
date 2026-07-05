import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { PlatformStatsService } from '../../core/services/platform-stats.service';
import { PlatformDashboard } from '../../core/models/stats.model';
import { PLAN_TIERS, PlanTier } from '../../core/models/subscription.model';

interface Kpi {
  labelKey: string;
  value: number;
  icon: string;
  accent: string;
}

interface PlanBar {
  tier: PlanTier;
  tribes: number;
  pct: number;
  color: string;
}

// Validated categorical palette (dataviz skill, light surface): blue/aqua/yellow/green.
// Sub-3:1 slots (aqua, yellow) carry direct labels, satisfying the relief rule.
const TIER_COLORS: Record<PlanTier, string> = {
  free: '#2a78d6',
  basic: '#1baf7a',
  professional: '#eda100',
  enterprise: '#008300',
};

@Component({
  selector: 'pw-platform-dashboard',
  imports: [DecimalPipe, DatePipe, RouterLink, TranslatePipe, ButtonModule, TableModule],
  template: `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold">{{ 'statistics.title' | translate }}</h1>
        <p class="text-sm text-slate-500">
          {{ 'statistics.subtitle' | translate }}
          @if (data()?.refreshedAt; as r) {
            · {{ 'statistics.refreshedAt' | translate }} {{ r | date: 'short' }}
          }
        </p>
      </div>
      <button
        pButton
        type="button"
        [label]="'common.refresh' | translate"
        icon="pi pi-refresh"
        [outlined]="true"
        (click)="load()"
      ></button>
    </div>

    @if (error()) {
      <div class="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {{ 'errors.loadFailed' | translate }}
      </div>
    }

    <!-- KPI cards -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      @for (k of kpis(); track k.labelKey) {
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">{{ k.labelKey | translate }}</span>
            <span
              class="inline-flex items-center justify-center w-8 h-8 rounded-lg"
              [style.background]="k.accent + '1a'"
              [style.color]="k.accent"
            >
              <i [class]="'pi ' + k.icon"></i>
            </span>
          </div>
          <div class="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            @if (loading()) {
              <span class="text-slate-300">—</span>
            } @else {
              {{ k.value | number }}
            }
          </div>
        </div>
      }
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Tribes by plan -->
      <section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-700 mb-4">
          {{ 'statistics.byPlan' | translate }}
        </h2>
        @if (planBars().length === 0) {
          <p class="text-sm text-slate-400 py-6 text-center">{{ 'statistics.noData' | translate }}</p>
        } @else {
          <div class="space-y-3" role="list" [attr.aria-label]="'statistics.byPlan' | translate">
            @for (bar of planBars(); track bar.tier) {
              <div class="flex items-center gap-3" role="listitem">
                <div class="w-24 shrink-0 text-sm text-slate-600">{{ 'plan.' + bar.tier | translate }}</div>
                <div class="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
                  <div
                    class="h-full rounded flex items-center justify-end pe-2"
                    [style.width.%]="bar.pct"
                    [style.background]="bar.color"
                    [style.min-width.px]="bar.tribes > 0 ? 24 : 0"
                  >
                    @if (bar.pct >= 22) {
                      <span class="text-[11px] font-semibold text-white tabular-nums">{{ bar.tribes | number }}</span>
                    }
                  </div>
                </div>
                @if (bar.pct < 22) {
                  <span class="w-8 text-end text-sm font-semibold text-slate-700 tabular-nums">{{ bar.tribes | number }}</span>
                }
              </div>
            }
          </div>
        }
      </section>

      <!-- Expiring soon -->
      <section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <i class="pi pi-clock text-amber-500"></i>{{ 'statistics.expiringSoon' | translate }}
        </h2>
        <p-table [value]="data()?.expiringSoon ?? []" [loading]="loading()" styleClass="p-datatable-sm">
          <ng-template #header>
            <tr>
              <th>{{ 'tenants.col.name' | translate }}</th>
              <th class="text-end">{{ 'subscription.field.expiresAt' | translate }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-e>
            <tr>
              <td class="text-sm">
                <a [routerLink]="['/tenants']" class="text-indigo-600 hover:underline">{{ e.nameEn }}</a>
              </td>
              <td class="text-end text-sm text-amber-700">{{ e.expiresAt | date: 'mediumDate' }}</td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="2" class="text-center text-slate-400 py-6">{{ 'statistics.noneExpiring' | translate }}</td>
            </tr>
          </ng-template>
        </p-table>
      </section>
    </div>
  `,
})
export class PlatformDashboardComponent {
  private readonly service = inject(PlatformStatsService);

  readonly data = signal<PlatformDashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly kpis = computed<Kpi[]>(() => {
    const d = this.data();
    return [
      { labelKey: 'statistics.kpi.tribes', value: d?.tribes ?? 0, icon: 'pi-sitemap', accent: '#4f46e5' },
      { labelKey: 'statistics.kpi.active', value: d?.activeTribes ?? 0, icon: 'pi-check-circle', accent: '#059669' },
      { labelKey: 'statistics.kpi.suspended', value: d?.suspendedTribes ?? 0, icon: 'pi-ban', accent: '#dc2626' },
      { labelKey: 'statistics.kpi.persons', value: d?.totalPersons ?? 0, icon: 'pi-users', accent: '#0891b2' },
      { labelKey: 'statistics.kpi.users', value: d?.totalUsers ?? 0, icon: 'pi-id-card', accent: '#7c3aed' },
    ];
  });

  readonly planBars = computed<PlanBar[]>(() => {
    const d = this.data();
    if (!d) return [];
    const counts = new Map<string, number>();
    for (const b of d.byPlan ?? []) counts.set(b.tier.toLowerCase(), b.tribes);
    const max = Math.max(1, ...PLAN_TIERS.map((t) => counts.get(t) ?? 0));
    return PLAN_TIERS.map((tier) => {
      const tribes = counts.get(tier) ?? 0;
      return {
        tier,
        tribes,
        pct: Math.round((tribes / max) * 100),
        color: TIER_COLORS[tier],
      };
    });
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.service.dashboard().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}

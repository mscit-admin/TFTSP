import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { PlatformService } from '../../core/services/platform.service';
import { PlatformStats } from '../../core/models/tenant.model';

interface StatCard {
  key: keyof PlatformStats;
  labelKey: string;
  icon: string;
  accent: string;
}

@Component({
  selector: 'pw-dashboard',
  imports: [TranslatePipe, DecimalPipe, ButtonModule],
  template: `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold">{{ 'dashboard.title' | translate }}</h1>
        <p class="text-sm text-slate-500">{{ 'dashboard.subtitle' | translate }}</p>
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

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      @for (card of cards; track card.key) {
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-slate-500">{{
              card.labelKey | translate
            }}</span>
            <span
              class="inline-flex items-center justify-center w-9 h-9 rounded-lg"
              [style.background]="card.accent + '1a'"
              [style.color]="card.accent"
            >
              <i [class]="'pi ' + card.icon"></i>
            </span>
          </div>
          <div class="mt-3 text-3xl font-bold text-slate-900">
            @if (loading()) {
              <span class="text-slate-300">—</span>
            } @else {
              {{ (stats()?.[card.key] ?? 0) | number }}
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent {
  private readonly platform = inject(PlatformService);

  readonly stats = signal<PlatformStats | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly cards: StatCard[] = [
    { key: 'tribes', labelKey: 'dashboard.tribes', icon: 'pi-sitemap', accent: '#4f46e5' },
    { key: 'persons', labelKey: 'dashboard.persons', icon: 'pi-users', accent: '#0891b2' },
    { key: 'users', labelKey: 'dashboard.users', icon: 'pi-id-card', accent: '#059669' },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.platform.stats().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}

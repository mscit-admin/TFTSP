import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ReputationService } from '../../core/services/reputation.service';
import { trustSeverity } from '../../core/util/trust';
import type { ContributorReputation } from '../../core/models';

@Component({
  selector: 'app-my-reputation',
  standalone: true,
  imports: [TranslatePipe, TagModule, MessageModule],
  template: `
    <div class="mx-auto max-w-xl">
      <h1 class="mb-4 text-xl font-semibold text-gray-800">{{ 'reputation.myTitle' | translate }}</h1>

      @if (loading()) {
        <p class="text-gray-400">{{ 'common.loading' | translate }}</p>
      } @else if (notAvailable()) {
        <p-message severity="info" [text]="'reputation.none' | translate" />
      } @else if (rep(); as r) {
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
            <span class="text-sm text-gray-600">{{ 'reputation.trustLevel' | translate }}</span>
            <p-tag [value]="'reputation.trust.' + r.trustLevel | translate" [severity]="trustSev(r.trustLevel)" />
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            @for (t of tiles(); track t.key) {
              <div class="rounded-lg border border-gray-200 bg-white p-4 text-center">
                <div class="text-2xl font-semibold" [class]="t.class">{{ t.value }}</div>
                <div class="text-xs text-gray-500">{{ t.key | translate }}</div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class MyReputationComponent {
  private readonly service = inject(ReputationService);

  readonly rep = signal<ContributorReputation | null>(null);
  readonly loading = signal(true);
  readonly notAvailable = signal(false);

  readonly trustSev = trustSeverity;

  readonly tiles = computed(() => {
    const r = this.rep();
    if (!r) return [];
    return [
      { key: 'reputation.total', value: r.totalContributions, class: 'text-gray-800' },
      { key: 'reputation.accepted', value: r.accepted, class: 'text-green-600' },
      { key: 'reputation.rejected', value: r.rejected, class: 'text-red-600' },
      { key: 'reputation.accuracy', value: (r.accuracyRate * 100).toFixed(0) + '%', class: 'text-sky-600' },
    ];
  });

  constructor() {
    this.service.me().subscribe({
      next: (r) => {
        this.rep.set(r);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        // 404 = no contributions yet / not a contributor in this tenant.
        this.notAvailable.set(err.status === 404);
        this.loading.set(false);
      },
    });
  }
}

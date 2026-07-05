import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { ReputationService } from '../../core/services/reputation.service';
import { trustSeverity } from '../../core/util/trust';
import type { ContributorReputation, ReputationThresholds } from '../../core/models';

@Component({
  selector: 'app-contributors',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    TableModule,
    TagModule,
    ButtonModule,
    InputNumberModule,
    ToggleSwitchModule,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'reputation.contributorsTitle' | translate }}</h1>
        <p-button icon="pi pi-refresh" [text]="true" size="small" (onClick)="reload()" />
      </div>

      <!-- Ranked contributors -->
      <p-table [value]="contributors()" [loading]="loading()" [paginator]="contributors().length > 10" [rows]="10" dataKey="userId" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'reputation.contributor' | translate }}</th>
            <th class="text-center">{{ 'reputation.total' | translate }}</th>
            <th class="text-center">{{ 'reputation.accepted' | translate }}</th>
            <th class="text-center">{{ 'reputation.rejected' | translate }}</th>
            <th class="text-center">{{ 'reputation.accuracy' | translate }}</th>
            <th>{{ 'reputation.trustLevel' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-c>
          <tr>
            <td>{{ c.fullName || shortId(c.userId) }}</td>
            <td class="text-center">{{ c.totalContributions }}</td>
            <td class="text-center text-green-600">{{ c.accepted }}</td>
            <td class="text-center text-red-600">{{ c.rejected }}</td>
            <td class="text-center">{{ (c.accuracyRate * 100).toFixed(0) }}%</td>
            <td><p-tag [value]="'reputation.trust.' + c.trustLevel | translate" [severity]="trustSev(c.trustLevel)" /></td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="6" class="py-8 text-center text-gray-400">{{ 'reputation.noContributors' | translate }}</td></tr>
        </ng-template>
      </p-table>

      <!-- Thresholds -->
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h2 class="mb-1 font-medium text-gray-700">{{ 'reputation.thresholdsTitle' | translate }}</h2>
        <p class="mb-4 text-sm text-gray-500">{{ 'reputation.thresholdsSubtitle' | translate }}</p>
        <form [formGroup]="form" (ngSubmit)="save()" class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'reputation.silverMinAccepted' | translate }}</span>
            <p-inputnumber formControlName="silverMinAccepted" [min]="0" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'reputation.goldMinAccepted' | translate }}</span>
            <p-inputnumber formControlName="goldMinAccepted" [min]="0" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'reputation.silverMinAccuracy' | translate }}</span>
            <p-inputnumber formControlName="silverMinAccuracyPct" [min]="0" [max]="100" suffix="%" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'reputation.goldMinAccuracy' | translate }}</span>
            <p-inputnumber formControlName="goldMinAccuracyPct" [min]="0" [max]="100" suffix="%" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'reputation.maxPending' | translate }}</span>
            <p-inputnumber formControlName="maxPending" [min]="1" [max]="100" />
          </label>
          <div class="flex items-center gap-3 md:col-span-2">
            <p-toggleswitch formControlName="allowViewerContributions" inputId="allowViewer" />
            <label for="allowViewer" class="flex flex-col">
              <span class="text-sm text-gray-700">{{ 'reputation.allowViewerContributions' | translate }}</span>
              <span class="text-xs text-gray-400">{{ 'reputation.allowViewerHint' | translate }}</span>
            </label>
          </div>
          <div class="md:col-span-2">
            <p-button type="submit" [label]="'actions.save' | translate" [loading]="saving()" [disabled]="form.invalid || saving()" />
          </div>
        </form>
      </div>
    </div>
  `,
})
export class ContributorsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ReputationService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly contributors = signal<ContributorReputation[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly trustSev = trustSeverity;

  readonly form = this.fb.nonNullable.group({
    silverMinAccepted: [10, [Validators.required, Validators.min(0)]],
    goldMinAccepted: [50, [Validators.required, Validators.min(0)]],
    silverMinAccuracyPct: [70, [Validators.required, Validators.min(0), Validators.max(100)]],
    goldMinAccuracyPct: [90, [Validators.required, Validators.min(0), Validators.max(100)]],
    maxPending: [20, [Validators.required, Validators.min(1)]],
    allowViewerContributions: [false],
  });

  constructor() {
    this.reload();
    this.service.getThresholds().subscribe({
      next: (t: ReputationThresholds) =>
        this.form.patchValue({
          silverMinAccepted: t.silverMinAccepted,
          goldMinAccepted: t.goldMinAccepted,
          silverMinAccuracyPct: Math.round(t.silverMinAccuracy * 100),
          goldMinAccuracyPct: Math.round(t.goldMinAccuracy * 100),
          maxPending: t.maxPending,
          allowViewerContributions: t.allowViewerContributions,
        }),
      error: () => void 0,
    });
  }

  reload(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (list) => {
        this.contributors.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.contributors.set([]);
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.service
      .updateThresholds({
        silverMinAccepted: v.silverMinAccepted,
        goldMinAccepted: v.goldMinAccepted,
        silverMinAccuracy: v.silverMinAccuracyPct / 100,
        goldMinAccuracy: v.goldMinAccuracyPct / 100,
        maxPending: v.maxPending,
        allowViewerContributions: v.allowViewerContributions,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.messages.add({ severity: 'success', detail: this.i18n.instant('reputation.saved') });
        },
        error: () => {
          this.saving.set(false);
          this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
        },
      });
  }

  shortId(id: string): string {
    return id ? id.slice(0, 8) : '—';
  }
}

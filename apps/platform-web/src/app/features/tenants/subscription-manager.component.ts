import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { SubscriptionService } from '../../core/services/subscription.service';
import {
  PLAN_LIMITS,
  PLAN_TIERS,
  PlanTier,
  SetSubscriptionDto,
  SubscriptionActivation,
  SubscriptionStatus,
  TenantSubscription,
} from '../../core/models/subscription.model';

/** Days until a date (negative = past). null when no date. */
export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

@Component({
  selector: 'pw-subscription-manager',
  imports: [
    DatePipe,
    TranslatePipe,
    DialogModule,
    ButtonModule,
    TagModule,
    TableModule,
    InputTextModule,
  ],
  template: `
    <p-dialog
      [header]="'subscription.dialog.title' | translate"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '46rem' }"
      [dismissableMask]="true"
      (onShow)="load()"
    >
      <p class="text-sm text-slate-500 -mt-2 mb-4">{{ tenantName() }}</p>

      @if (loadError()) {
        <div class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {{ 'errors.loadFailed' | translate }}
        </div>
      }

      <!-- Current subscription -->
      <section class="mb-5">
        <h3 class="text-sm font-semibold text-slate-700 mb-2">
          {{ 'subscription.current.title' | translate }}
        </h3>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div class="text-xs text-slate-500">{{ 'subscription.field.tier' | translate }}</div>
            <div class="font-medium">{{ (sub() ? 'plan.' + sub()!.tier : 'common.none') | translate }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500">{{ 'subscription.field.status' | translate }}</div>
            @if (sub(); as s) {
              <p-tag [value]="'subscription.status.' + s.status | translate" [severity]="statusSeverity(s.status)" />
            } @else {
              <span class="text-slate-400">—</span>
            }
          </div>
          <div>
            <div class="text-xs text-slate-500">{{ 'subscription.field.activatedAt' | translate }}</div>
            <div class="text-sm">{{ (sub()?.activatedAt | date: 'mediumDate') || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500">{{ 'subscription.field.expiresAt' | translate }}</div>
            <div class="text-sm flex items-center gap-2">
              {{ (sub()?.expiresAt | date: 'mediumDate') || '—' }}
              @if (expiryDays() !== null && expiryDays()! <= 30) {
                <span
                  class="text-[11px] px-1.5 py-0.5 rounded border"
                  [class]="expiryDays()! < 0
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'"
                >
                  {{ (expiryDays()! < 0 ? 'subscription.expired' : 'subscription.expiresInDays')
                     | translate: { days: absDays() } }}
                </span>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- Assign / activate plan -->
      <section class="mb-5">
        <h3 class="text-sm font-semibold text-slate-700 mb-2">
          {{ 'subscription.assign.title' | translate }}
        </h3>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          @for (tier of tiers; track tier) {
            <button
              type="button"
              (click)="selectedTier.set(tier)"
              class="text-start rounded-lg border p-3 transition"
              [class]="selectedTier() === tier
                ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'"
            >
              <div class="font-medium text-sm">{{ 'plan.' + tier | translate }}</div>
              <div class="text-xs text-slate-500 mt-1">
                {{ capLabel(tier) }}
              </div>
            </button>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm text-slate-600">{{ 'subscription.field.expiresAt' | translate }}</span>
            <input
              type="date"
              [value]="expiresInput()"
              (input)="expiresInput.set($any($event.target).value)"
              class="w-full mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              dir="ltr"
            />
          </label>
          <label class="block">
            <span class="text-sm text-slate-600">{{ 'subscription.field.note' | translate }}</span>
            <input
              pInputText
              [value]="note()"
              (input)="note.set($any($event.target).value)"
              class="w-full mt-1"
              [placeholder]="'subscription.field.notePlaceholder' | translate"
            />
          </label>
        </div>
        <p class="text-xs text-slate-400 mt-1">{{ 'subscription.assign.manualHint' | translate }}</p>

        @if (saveError()) {
          <div class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">
            {{ saveError()! | translate }}
          </div>
        }
        @if (savedOk()) {
          <div class="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mt-3">
            {{ 'subscription.toast.saved' | translate }}
          </div>
        }

        <div class="flex justify-end mt-3">
          <button
            pButton
            type="button"
            icon="pi pi-check"
            [disabled]="!selectedTier() || saving()"
            [label]="(saving() ? 'common.saving' : 'subscription.assign.submit') | translate"
            (click)="save()"
          ></button>
        </div>
      </section>

      <!-- Activation log -->
      <section>
        <h3 class="text-sm font-semibold text-slate-700 mb-2">
          {{ 'subscription.log.title' | translate }}
        </h3>
        <p-table [value]="activations()" [loading]="loading()" styleClass="p-datatable-sm" [rows]="5" [paginator]="activations().length > 5">
          <ng-template #header>
            <tr>
              <th>{{ 'subscription.log.date' | translate }}</th>
              <th>{{ 'subscription.field.tier' | translate }}</th>
              <th>{{ 'subscription.log.by' | translate }}</th>
              <th>{{ 'subscription.field.note' | translate }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-a>
            <tr>
              <td class="text-sm">{{ a.createdAt | date: 'medium' }}</td>
              <td><p-tag [value]="'plan.' + a.tier | translate" severity="info" /></td>
              <td class="text-sm text-slate-600">{{ a.activatedBy }}</td>
              <td class="text-sm text-slate-600">{{ a.note || '—' }}</td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="4" class="text-center text-slate-400 py-6">
                {{ 'subscription.log.empty' | translate }}
              </td>
            </tr>
          </ng-template>
        </p-table>
      </section>
    </p-dialog>
  `,
})
export class SubscriptionManagerComponent {
  private readonly service = inject(SubscriptionService);

  readonly tenantId = input.required<string>();
  readonly tenantName = input<string>('');
  readonly visible = model<boolean>(false);
  /** Emitted after a successful PUT so the parent can refresh its list. */
  readonly saved = output<TenantSubscription>();

  readonly tiers = PLAN_TIERS;

  readonly sub = signal<TenantSubscription | null>(null);
  readonly activations = signal<SubscriptionActivation[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  readonly selectedTier = signal<PlanTier | null>(null);
  readonly expiresInput = signal<string>('');
  readonly note = signal<string>('');
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly savedOk = signal(false);

  readonly expiryDays = signal<number | null>(null);

  constructor() {
    // Recompute expiry countdown whenever the current subscription changes.
    effect(() => {
      this.expiryDays.set(daysUntil(this.sub()?.expiresAt));
    });
  }

  absDays(): number {
    return Math.abs(this.expiryDays() ?? 0);
  }

  capLabel(tier: PlanTier): string {
    const cap = PLAN_LIMITS[tier];
    return cap === null ? '∞' : `≤ ${cap.toLocaleString()}`;
  }

  statusSeverity(s: SubscriptionStatus): 'success' | 'warn' | 'danger' {
    if (s === 'active') return 'success';
    if (s === 'expired') return 'danger';
    return 'warn';
  }

  load(): void {
    const id = this.tenantId();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.savedOk.set(false);
    this.saveError.set(null);

    this.service.get(id).subscribe({
      next: (s) => {
        this.sub.set(s);
        this.selectedTier.set(s.tier);
        this.expiresInput.set(toDateInput(s.expiresAt));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        // 404 = no subscription yet; not an error, just an empty starting state.
        if (err.status !== 404) this.loadError.set(true);
        this.sub.set(null);
        this.selectedTier.set('free');
      },
    });

    this.service.activations(id).subscribe({
      next: (rows) => this.activations.set(rows),
      error: () => this.activations.set([]),
    });
  }

  save(): void {
    const tier = this.selectedTier();
    if (!tier) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.savedOk.set(false);

    const dto: SetSubscriptionDto = { tier };
    const exp = this.expiresInput().trim();
    if (exp) dto.expiresAt = new Date(exp).toISOString();
    const n = this.note().trim();
    if (n) dto.note = n;

    this.service.set(this.tenantId(), dto).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.savedOk.set(true);
        this.sub.set(s);
        this.note.set('');
        this.saved.emit(s);
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('subscription.errors.saveFailed');
      },
    });
  }
}

function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

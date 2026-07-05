import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PlatformService } from '../../core/services/platform.service';
import { PlatformStatsService } from '../../core/services/platform-stats.service';
import { LanguageService } from '../../core/services/language.service';
import { CreateTenantRequest, TenantRow } from '../../core/models/tenant.model';
import {
  SubscriptionManagerComponent,
  daysUntil,
} from './subscription-manager.component';

@Component({
  selector: 'pw-tenants-list',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    TranslatePipe,
    TableModule,
    ButtonModule,
    DialogModule,
    TagModule,
    InputTextModule,
    ToastModule,
    SubscriptionManagerComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold">{{ 'tenants.title' | translate }}</h1>
        <p class="text-sm text-slate-500">{{ 'tenants.subtitle' | translate }}</p>
      </div>
      <button
        pButton
        type="button"
        icon="pi pi-plus"
        [label]="'tenants.create' | translate"
        (click)="openCreate()"
      ></button>
    </div>

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <p-table
        [value]="tenants()"
        [loading]="loading()"
        [paginator]="tenants().length > 10"
        [rows]="10"
        styleClass="p-datatable-sm"
      >
        <ng-template #header>
          <tr>
            <th>{{ 'tenants.col.name' | translate }}</th>
            <th>{{ 'tenants.col.slug' | translate }}</th>
            <th class="text-center">{{ 'tenants.col.persons' | translate }}</th>
            <th class="text-center">{{ 'tenants.col.users' | translate }}</th>
            <th class="text-center">{{ 'tenants.col.status' | translate }}</th>
            <th class="text-end">{{ 'tenants.col.actions' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template #body let-t>
          <tr [class.bg-amber-50]="isExpiringSoon(t.id)">
            <td class="font-medium">
              {{ nameFor(t) }}
              @if (expiryBadge(t.id); as badge) {
                <span
                  class="ms-2 align-middle text-[11px] px-1.5 py-0.5 rounded border"
                  [class]="badge.expired
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-100 text-amber-800 border-amber-300'"
                >
                  <i class="pi pi-clock text-[10px] me-1"></i>{{ badge.label | translate: badge.params }}
                </span>
              }
            </td>
            <td><code class="text-xs text-slate-500">{{ t.slug }}</code></td>
            <td class="text-center">{{ t.personsCount | number }}</td>
            <td class="text-center">{{ t.usersCount | number }}</td>
            <td class="text-center">
              <p-tag
                [value]="'tenants.status.' + t.status | translate"
                [severity]="t.status === 'active' ? 'success' : 'danger'"
              />
            </td>
            <td class="text-end whitespace-nowrap">
              <button
                pButton
                type="button"
                size="small"
                severity="secondary"
                [outlined]="true"
                icon="pi pi-credit-card"
                [label]="'subscription.manage' | translate"
                class="me-2"
                (click)="openManage(t)"
              ></button>
              @if (t.status === 'active') {
                <button
                  pButton
                  type="button"
                  size="small"
                  severity="danger"
                  [outlined]="true"
                  icon="pi pi-ban"
                  [label]="'tenants.action.suspend' | translate"
                  [disabled]="busyId() === t.id"
                  (click)="suspend(t)"
                ></button>
              } @else {
                <button
                  pButton
                  type="button"
                  size="small"
                  severity="success"
                  [outlined]="true"
                  icon="pi pi-check"
                  [label]="'tenants.action.activate' | translate"
                  [disabled]="busyId() === t.id"
                  (click)="activate(t)"
                ></button>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="6" class="text-center text-slate-400 py-8">
              {{ 'tenants.empty' | translate }}
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Create tribe + first Tribe Administrator -->
    <p-dialog
      [header]="'tenants.dialog.title' | translate"
      [(visible)]="dialogOpen"
      [modal]="true"
      [style]="{ width: '32rem' }"
      [dismissableMask]="true"
    >
      <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm text-slate-600">{{ 'tenants.field.nameAr' | translate }}</span>
            <input pInputText formControlName="nameAr" class="w-full mt-1" dir="rtl" />
          </label>
          <label class="block">
            <span class="text-sm text-slate-600">{{ 'tenants.field.nameEn' | translate }}</span>
            <input pInputText formControlName="nameEn" class="w-full mt-1" dir="ltr" />
          </label>
        </div>

        <label class="block">
          <span class="text-sm text-slate-600">{{ 'tenants.field.slug' | translate }}</span>
          <input pInputText formControlName="slug" class="w-full mt-1" dir="ltr" placeholder="bani-hilal" />
        </label>

        <div class="border-t border-slate-200 pt-3">
          <p class="text-sm font-medium text-slate-700 mb-2">
            {{ 'tenants.dialog.adminSection' | translate }}
          </p>
          <div formGroupName="admin" class="space-y-3">
            <label class="block">
              <span class="text-sm text-slate-600">{{ 'tenants.field.adminName' | translate }}</span>
              <input pInputText formControlName="fullName" class="w-full mt-1" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-600">{{ 'tenants.field.adminEmail' | translate }}</span>
              <input pInputText type="email" formControlName="email" class="w-full mt-1" dir="ltr" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-600">{{ 'tenants.field.adminPassword' | translate }}</span>
              <input pInputText type="password" formControlName="password" class="w-full mt-1" dir="ltr" />
              <span class="text-xs text-slate-400">{{ 'tenants.field.passwordHint' | translate }}</span>
            </label>
          </div>
        </div>

        @if (formError()) {
          <div class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {{ formError()! | translate }}
          </div>
        }

        <div class="flex justify-end gap-2 pt-2">
          <button
            pButton
            type="button"
            [text]="true"
            [label]="'common.cancel' | translate"
            (click)="dialogOpen.set(false)"
          ></button>
          <button
            pButton
            type="submit"
            [disabled]="form.invalid || saving()"
            [label]="(saving() ? 'common.saving' : 'common.save') | translate"
          ></button>
        </div>
      </form>
    </p-dialog>

    <!-- Per-tribe subscription management (M4) -->
    @if (manageTenant(); as mt) {
      <pw-subscription-manager
        [tenantId]="mt.id"
        [tenantName]="nameFor(mt)"
        [(visible)]="manageOpen"
        (saved)="onSubscriptionSaved()"
      />
    }
  `,
})
export class TenantsListComponent {
  private readonly platform = inject(PlatformService);
  private readonly stats = inject(PlatformStatsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly i18n = inject(TranslateService);
  private readonly lang = inject(LanguageService);

  readonly tenants = signal<TenantRow[]>([]);
  readonly loading = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly dialogOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  // Subscription management + expiry alerts (M4).
  readonly manageTenant = signal<TenantRow | null>(null);
  readonly manageOpen = signal(false);
  /** tenantId -> expiresAt ISO, from PlatformDashboard.expiringSoon (≤30 days). */
  private readonly expiring = signal<Map<string, string>>(new Map());

  readonly form = this.fb.nonNullable.group({
    slug: [
      '',
      [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)],
    ],
    nameAr: ['', Validators.required],
    nameEn: ['', Validators.required],
    admin: this.fb.nonNullable.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(12)]],
    }),
  });

  // Reads the isRtl() signal so the shown name follows instant language switches.
  nameFor(t: TenantRow): string {
    return this.lang.isRtl() ? t.nameAr || t.nameEn : t.nameEn || t.nameAr;
  }

  constructor() {
    this.load();
    this.loadExpiring();
  }

  load(): void {
    this.loading.set(true);
    this.platform.listTenants().subscribe({
      next: (rows) => {
        this.tenants.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notifyError('errors.loadFailed');
      },
    });
  }

  /** Best-effort: the dashboard's expiringSoon list feeds the per-row expiry badges. */
  private loadExpiring(): void {
    this.stats.dashboard().subscribe({
      next: (d) => {
        const map = new Map<string, string>();
        for (const e of d.expiringSoon ?? []) map.set(e.tenantId, e.expiresAt);
        this.expiring.set(map);
      },
      error: () => this.expiring.set(new Map()),
    });
  }

  isExpiringSoon(tenantId: string): boolean {
    return this.expiring().has(tenantId);
  }

  expiryBadge(
    tenantId: string,
  ): { label: string; params: { days: number }; expired: boolean } | null {
    const iso = this.expiring().get(tenantId);
    if (!iso) return null;
    const days = daysUntil(iso) ?? 0;
    return {
      label: days < 0 ? 'subscription.expired' : 'subscription.expiresInDays',
      params: { days: Math.abs(days) },
      expired: days < 0,
    };
  }

  openManage(t: TenantRow): void {
    this.manageTenant.set(t);
    this.manageOpen.set(true);
  }

  onSubscriptionSaved(): void {
    this.notifySuccess('subscription.toast.saved');
    this.loadExpiring();
  }

  openCreate(): void {
    this.form.reset();
    this.formError.set(null);
    this.dialogOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.formError.set(null);

    const v = this.form.getRawValue();
    const body: CreateTenantRequest = {
      slug: v.slug,
      nameAr: v.nameAr,
      nameEn: v.nameEn,
      admin: {
        fullName: v.admin.fullName,
        email: v.admin.email,
        password: v.admin.password,
      },
    };

    this.platform.createTenant(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.notifySuccess('tenants.toast.created');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(this.mapCreateError(err));
      },
    });
  }

  suspend(t: TenantRow): void {
    this.busyId.set(t.id);
    this.platform.suspendTenant(t.id).subscribe({
      next: () => this.afterStatusChange(t.id, 'suspended', 'tenants.toast.suspended'),
      error: () => this.afterStatusError(),
    });
  }

  activate(t: TenantRow): void {
    this.busyId.set(t.id);
    this.platform.activateTenant(t.id).subscribe({
      next: () => this.afterStatusChange(t.id, 'active', 'tenants.toast.activated'),
      error: () => this.afterStatusError(),
    });
  }

  private afterStatusChange(
    id: string,
    status: TenantRow['status'],
    toastKey: string,
  ): void {
    this.tenants.update((rows) =>
      rows.map((r) => (r.id === id ? { ...r, status } : r)),
    );
    this.busyId.set(null);
    this.notifySuccess(toastKey);
  }

  private afterStatusError(): void {
    this.busyId.set(null);
    this.notifyError('errors.actionFailed');
  }

  private mapCreateError(err: HttpErrorResponse): string {
    const key = (err.error as { messageKey?: string } | null)?.messageKey;
    if (key === 'errors.slug_taken' || err.status === 409) return 'tenants.errors.slugTaken';
    return 'tenants.errors.createFailed';
  }

  private notifySuccess(key: string): void {
    this.toast.add({
      severity: 'success',
      summary: this.i18n.instant('common.done') as string,
      detail: this.i18n.instant(key) as string,
    });
  }

  private notifyError(key: string): void {
    this.toast.add({
      severity: 'error',
      summary: this.i18n.instant('common.error') as string,
      detail: this.i18n.instant(key) as string,
    });
  }
}

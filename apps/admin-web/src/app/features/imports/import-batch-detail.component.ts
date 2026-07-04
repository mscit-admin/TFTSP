import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ImportService } from '../../core/services/import.service';
import { AuthService } from '../../core/services/auth.service';
import { ImportPreviewComponent } from './import-preview.component';
import { importStatusSeverity } from '../../core/util/import-status';
import { IMPORT_PROCESSING_STATUSES, IMPORT_ROLLBACKABLE_STATUSES } from '../../core/models';
import type { ApiErrorBody, ImportBatch } from '../../core/models';

@Component({
  selector: 'app-import-batch-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    TranslatePipe,
    TagModule,
    ButtonModule,
    ProgressBarModule,
    MessageModule,
    ConfirmDialogModule,
    ImportPreviewComponent,
  ],
  providers: [ConfirmationService],
  template: `
    <p-confirmdialog />
    <div class="mx-auto flex max-w-4xl flex-col gap-5">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'imports.detailTitle' | translate }}</h1>
        <p-button
          icon="pi pi-arrow-left"
          [text]="true"
          severity="secondary"
          [ariaLabel]="'actions.back' | translate"
          (onClick)="back()"
        />
      </div>

      @if (batch(); as b) {
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-3">
              <span class="font-medium text-gray-800">{{ b.filename }}</span>
              <p-tag [value]="'imports.status.' + b.status | translate" [severity]="severity(b.status)" />
            </div>
            <span class="text-xs text-gray-400" [attr.dir]="'ltr'">{{ b.createdAt | date: 'short' }}</span>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
            @for (s of statCards(); track s.key) {
              <div class="rounded-md bg-gray-50 p-2">
                <div class="text-lg font-semibold" [class]="s.class">{{ s.value }}</div>
                <div class="text-xs text-gray-500">{{ s.key | translate }}</div>
              </div>
            }
          </div>

          @if (b.changeRequestId) {
            <div class="mt-3">
              <p-button
                icon="pi pi-file-edit"
                [label]="'imports.openRequest' | translate"
                size="small"
                [text]="true"
                [routerLink]="['/change-requests', b.changeRequestId]"
              />
            </div>
          }
        </div>

        <!-- Processing -->
        @if (isProcessing()) {
          <section class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <i class="pi pi-spin pi-spinner"></i>
              <span>{{ 'imports.status.' + b.status | translate }}</span>
            </div>
            <p-progressbar [value]="progress()" />
          </section>
        }

        <!-- Preview + submit -->
        @if (b.status === 'preview') {
          <app-import-preview [batch]="b" (submitted)="onSubmitted($event)" />
        }

        <!-- Rollback -->
        @if (canRollback()) {
          <section class="rounded-lg border border-red-200 bg-white p-4">
            <h2 class="mb-2 font-medium text-red-700">{{ 'imports.rollback.title' | translate }}</h2>
            <p class="mb-3 text-sm text-gray-600">{{ 'imports.rollback.body' | translate }}</p>
            @if (rollbackErrorKey()) {
              <p-message severity="error" [text]="rollbackErrorKey()! | translate" styleClass="mb-3" />
              @if (blockingDeps().length) {
                <ul class="mb-3 list-disc ps-6 text-sm text-red-600">
                  @for (d of blockingDeps(); track d) {
                    <li>{{ d }}</li>
                  }
                </ul>
              }
            }
            <p-button
              icon="pi pi-undo"
              [label]="'imports.rollback.action' | translate"
              severity="danger"
              [loading]="rollingBack()"
              (onClick)="confirmRollback()"
            />
          </section>
        }
      } @else if (loading()) {
        <p class="text-gray-400">{{ 'common.loading' | translate }}</p>
      } @else {
        <p class="text-gray-400">{{ 'imports.notFound' | translate }}</p>
      }
    </div>
  `,
})
export class ImportBatchDetailComponent {
  private readonly service = inject(ImportService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input<string>();

  readonly batch = signal<ImportBatch | null>(null);
  readonly loading = signal(true);
  readonly progress = signal(0);
  readonly rollingBack = signal(false);
  readonly rollbackErrorKey = signal<string | null>(null);
  readonly blockingDeps = signal<string[]>([]);

  private socketConnected = false;

  readonly isProcessing = computed(() => {
    const b = this.batch();
    return !!b && IMPORT_PROCESSING_STATUSES.includes(b.status);
  });

  readonly canRollback = computed(() => {
    const b = this.batch();
    // Batch-level rollback is Tribe Admin only (Spec §12).
    return !!b && this.auth.isTribeAdmin() && IMPORT_ROLLBACKABLE_STATUSES.includes(b.status);
  });

  readonly statCards = computed(() => {
    const b = this.batch();
    if (!b) return [];
    const c = b.counts;
    return [
      { key: 'imports.counts.total', value: c.total, class: 'text-gray-800' },
      { key: 'imports.counts.valid', value: c.valid, class: 'text-green-600' },
      { key: 'imports.counts.error', value: c.error, class: 'text-red-600' },
      { key: 'imports.counts.duplicateCandidate', value: c.duplicateCandidate, class: 'text-amber-600' },
      { key: 'imports.counts.created', value: c.created, class: 'text-green-700' },
      { key: 'imports.counts.merged', value: c.merged, class: 'text-sky-600' },
    ];
  });

  constructor() {
    this.service.progress$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ev) => {
      const b = this.batch();
      if (!b || ev.importBatchId !== b.id) return;
      this.progress.set(ev.progress);
      // Reflect status transitions and refresh counts when they arrive.
      if (ev.status !== b.status) this.reload();
    });
    this.destroyRef.onDestroy(() => this.service.disconnect());

    queueMicrotask(() => {
      const id = this.id();
      if (id) this.reload();
      else this.loading.set(false);
    });
  }

  private reload(): void {
    const id = this.id();
    if (!id) return;
    this.service.get(id).subscribe({
      next: (b) => {
        this.batch.set(b);
        this.progress.set(b.progress ?? 0);
        this.loading.set(false);
        if (IMPORT_PROCESSING_STATUSES.includes(b.status) && !this.socketConnected) {
          this.service.connect();
          this.socketConnected = true;
        }
      },
      error: () => {
        this.batch.set(null);
        this.loading.set(false);
      },
    });
  }

  onSubmitted(b: ImportBatch): void {
    this.batch.set(b);
  }

  confirmRollback(): void {
    this.confirm.confirm({
      message: this.i18n.instant('imports.rollback.confirm'),
      header: this.i18n.instant('imports.rollback.title'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doRollback(),
    });
  }

  private doRollback(): void {
    const id = this.id();
    if (!id) return;
    this.rollingBack.set(true);
    this.rollbackErrorKey.set(null);
    this.blockingDeps.set([]);
    this.service.rollback(id).subscribe({
      next: (b) => {
        this.rollingBack.set(false);
        this.batch.set(b);
        this.messages.add({ severity: 'success', detail: this.i18n.instant('imports.rollback.done') });
      },
      error: (err: HttpErrorResponse) => {
        this.rollingBack.set(false);
        const body = err.error as ApiErrorBody | undefined;
        this.rollbackErrorKey.set(body?.messageKey ?? 'imports.rollback.refused');
        // Backend refusal (errors.import.rollback_blocked) returns the blocking records
        // split across `details.dependentChildren[]` and `details.unions[]`.
        const details = body?.details ?? {};
        const children = Array.isArray(details['dependentChildren']) ? details['dependentChildren'] : [];
        const unions = Array.isArray(details['unions']) ? details['unions'] : [];
        this.blockingDeps.set([...children, ...unions].map((d) => String(d)));
      },
    });
  }

  severity = importStatusSeverity;
  back(): void {
    this.router.navigate(['/imports']);
  }
}

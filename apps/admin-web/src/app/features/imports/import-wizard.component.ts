import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ImportService } from '../../core/services/import.service';
import { LanguageService } from '../../core/services/language.service';
import { ImportPreviewComponent } from './import-preview.component';
import { IMPORT_PROCESSING_STATUSES } from '../../core/models';
import type { ApiErrorBody, ImportBatch, ImportFileFormat } from '../../core/models';

type WizardStep = 'choose' | 'processing' | 'preview' | 'done';

@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    SelectButtonModule,
    ProgressBarModule,
    MessageModule,
    ImportPreviewComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-4xl flex-col gap-6">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'imports.wizardTitle' | translate }}</h1>
        <p-button
          icon="pi pi-list"
          [label]="'imports.allBatches' | translate"
          [text]="true"
          size="small"
          routerLink="/imports"
        />
      </div>

      <!-- Step indicator -->
      <ol class="flex flex-wrap gap-2 text-sm">
        @for (s of steps; track s.key; let i = $index) {
          <li
            class="flex items-center gap-2 rounded-full px-3 py-1"
            [class.bg-tribe]="isActive(s.key)"
            [class.text-white]="isActive(s.key)"
            [class.bg-gray-100]="!isActive(s.key)"
            [class.text-gray-500]="!isActive(s.key)"
          >
            <span class="font-semibold">{{ i + 1 }}</span>
            <span>{{ s.labelKey | translate }}</span>
          </li>
        }
      </ol>

      <!-- Step: choose + template -->
      @if (step() === 'choose') {
        <section class="flex flex-col gap-5 rounded-lg border border-gray-200 bg-white p-5">
          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700">{{ 'imports.format' | translate }}</span>
            <p-selectbutton
              [options]="formatOptions"
              [(ngModel)]="format"
              optionLabel="label"
              optionValue="value"
            />
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700">{{ 'imports.templateTitle' | translate }}</span>
            <p class="text-xs text-gray-500">{{ 'imports.templateHint' | translate }}</p>
            <div class="flex gap-2">
              <p-button
                icon="pi pi-download"
                [label]="'imports.downloadXlsx' | translate"
                severity="secondary"
                size="small"
                [loading]="downloading()"
                (onClick)="downloadTemplate('xlsx')"
              />
              <p-button
                icon="pi pi-download"
                [label]="'imports.downloadCsv' | translate"
                severity="secondary"
                size="small"
                [loading]="downloading()"
                (onClick)="downloadTemplate('csv')"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700">{{ 'imports.uploadTitle' | translate }}</span>
            <input
              type="file"
              [accept]="acceptTypes()"
              (change)="onFileSelected($event)"
              class="text-sm"
            />
            <small class="text-gray-400">{{ 'imports.sizeHint' | translate }}</small>
            @if (sizeError()) {
              <p-message severity="error" [text]="'imports.tooLarge' | translate" />
            }
          </div>

          <div>
            <p-button
              [label]="'imports.startUpload' | translate"
              [loading]="uploading()"
              [disabled]="!file || uploading() || sizeError()"
              (onClick)="startUpload()"
            />
          </div>
        </section>
      }

      <!-- Step: processing -->
      @if (step() === 'processing') {
        <section class="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <i class="pi pi-spin pi-spinner"></i>
            <span>{{ 'imports.status.' + statusLabel() | translate }}</span>
          </div>
          <p-progressbar [value]="progress()" />
          <p class="text-xs text-gray-400">{{ 'imports.processingHint' | translate }}</p>
          @if (failed()) {
            <p-message severity="error" [text]="'imports.processingFailed' | translate" />
          }
        </section>
      }

      <!-- Step: preview -->
      @if (step() === 'preview' && batch(); as b) {
        <app-import-preview [batch]="b" (submitted)="onSubmitted($event)" />
      }

      <!-- Step: done -->
      @if (step() === 'done' && batch(); as b) {
        <section class="flex flex-col items-start gap-4 rounded-lg border border-green-200 bg-white p-6">
          <div class="flex items-center gap-2 text-green-700">
            <i class="pi pi-check-circle text-xl"></i>
            <span class="font-medium">{{ 'imports.done.title' | translate }}</span>
          </div>
          <p class="text-sm text-gray-600">{{ 'imports.done.body' | translate }}</p>
          <div class="flex gap-2">
            @if (b.changeRequestId) {
              <p-button
                icon="pi pi-file-edit"
                [label]="'imports.done.openRequest' | translate"
                [routerLink]="['/change-requests', b.changeRequestId]"
              />
            }
            <p-button
              [label]="'imports.allBatches' | translate"
              severity="secondary"
              routerLink="/imports"
            />
          </div>
        </section>
      }
    </div>
  `,
})
export class ImportWizardComponent {
  private readonly service = inject(ImportService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private static readonly MAX_BYTES = 50 * 1024 * 1024;

  readonly step = signal<WizardStep>('choose');
  readonly batch = signal<ImportBatch | null>(null);
  readonly progress = signal(0);
  readonly statusLabel = signal('uploaded');
  readonly failed = signal(false);
  readonly uploading = signal(false);
  readonly downloading = signal(false);
  readonly sizeError = signal(false);

  format: ImportFileFormat = 'xlsx';
  file: File | null = null;

  readonly steps = [
    { key: 'choose', labelKey: 'imports.steps.choose' },
    { key: 'processing', labelKey: 'imports.steps.processing' },
    { key: 'preview', labelKey: 'imports.steps.preview' },
    { key: 'done', labelKey: 'imports.steps.done' },
  ] as const;

  readonly formatOptions = [
    { value: 'xlsx' as ImportFileFormat, label: 'XLSX' },
    { value: 'csv' as ImportFileFormat, label: 'CSV' },
  ];

  readonly acceptTypes = computed(() =>
    this.format === 'xlsx'
      ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : '.csv,text/csv',
  );

  constructor() {
    // Live progress for the active batch.
    this.service.progress$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ev) => {
      const current = this.batch();
      if (!current || ev.importBatchId !== current.id) return;
      this.progress.set(ev.progress);
      this.statusLabel.set(ev.status);
      if (ev.status === 'failed') {
        this.failed.set(true);
      } else if (ev.status === 'preview') {
        this.enterPreview(current.id);
      }
    });
    this.destroyRef.onDestroy(() => this.service.disconnect());
  }

  isActive(key: string): boolean {
    return this.step() === key;
  }

  downloadTemplate(format: ImportFileFormat): void {
    this.downloading.set(true);
    this.service.downloadTemplate(format, this.lang.lang()).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        this.saveBlob(blob, `tftsp-import-template.${format}`);
      },
      error: () => {
        this.downloading.set(false);
        this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
      },
    });
  }

  onFileSelected(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.sizeError.set(!!this.file && this.file.size > ImportWizardComponent.MAX_BYTES);
  }

  startUpload(): void {
    if (!this.file || this.sizeError()) return;
    this.uploading.set(true);
    this.failed.set(false);
    // Open the progress socket before the job starts emitting.
    this.service.connect();
    this.service.upload(this.file, this.format).subscribe({
      next: (b) => {
        this.uploading.set(false);
        this.batch.set(b);
        this.progress.set(b.progress ?? 0);
        this.statusLabel.set(b.status);
        if (b.status === 'preview') {
          this.enterPreview(b.id);
        } else if (IMPORT_PROCESSING_STATUSES.includes(b.status)) {
          this.step.set('processing');
        } else {
          this.step.set('processing');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.uploading.set(false);
        const body = err.error as ApiErrorBody | undefined;
        this.messages.add({
          severity: 'error',
          detail: this.i18n.instant(body?.messageKey ?? 'errors.generic'),
        });
      },
    });
  }

  private enterPreview(id: string): void {
    // Refresh the full batch (counts) before showing the preview.
    this.service.get(id).subscribe({
      next: (b) => {
        this.batch.set(b);
        this.step.set('preview');
      },
      error: () => this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') }),
    });
  }

  onSubmitted(b: ImportBatch): void {
    this.batch.set(b);
    this.step.set('done');
    this.service.disconnect();
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

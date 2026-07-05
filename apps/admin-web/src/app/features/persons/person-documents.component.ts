import { Component, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DocumentService } from '../../core/services/document.service';
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES } from '../../core/models';
import type { ApiErrorBody, DocumentWithUrl } from '../../core/models';

@Component({
  selector: 'app-person-documents',
  standalone: true,
  imports: [DatePipe, TranslatePipe, ButtonModule, MessageModule, ConfirmDialogModule],
  providers: [ConfirmationService],
  template: `
    <p-confirmdialog />
    <section class="rounded-lg border border-gray-200 bg-white p-4">
      <h2 class="mb-3 font-medium text-gray-700">{{ 'documents.title' | translate }}</h2>

      @if (docs().length === 0 && !loading()) {
        <p class="mb-3 text-sm text-gray-400">{{ 'documents.empty' | translate }}</p>
      }

      <ul class="mb-4 flex flex-col gap-2">
        @for (d of docs(); track d.id) {
          <li class="flex items-center justify-between gap-3 rounded-md border border-gray-100 p-2 text-sm">
            <a [href]="d.downloadUrl" target="_blank" rel="noopener" class="flex items-center gap-2 text-tribe hover:underline">
              <i class="pi {{ d.kind === 'pdf' ? 'pi-file-pdf' : 'pi-image' }}"></i>
              <span>{{ d.filename }}</span>
            </a>
            <span class="flex items-center gap-3">
              <span class="text-xs text-gray-400" [attr.dir]="'ltr'">{{ d.createdAt | date: 'short' }}</span>
              <p-button
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                size="small"
                (onClick)="confirmDelete(d)"
                [ariaLabel]="'actions.delete' | translate"
              />
            </span>
          </li>
        }
      </ul>

      @if (errorKey()) {
        <p-message severity="error" [text]="errorKey()! | translate" styleClass="mb-3" />
      }

      <div class="flex items-center gap-3">
        <input
          type="file"
          [accept]="accept"
          (change)="onFile($event)"
          class="text-sm"
          [disabled]="uploading()"
        />
        @if (uploading()) {
          <i class="pi pi-spin pi-spinner text-gray-400"></i>
        }
      </div>
      <small class="text-gray-400">{{ 'documents.hint' | translate }}</small>
    </section>
  `,
})
export class PersonDocumentsComponent {
  private readonly service = inject(DocumentService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly personId = input.required<string>();

  readonly docs = signal<DocumentWithUrl[]>([]);
  readonly loading = signal(false);
  readonly uploading = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly accept = DOCUMENT_ACCEPT;

  constructor() {
    queueMicrotask(() => this.reload());
  }

  private reload(): void {
    this.loading.set(true);
    this.service.list(this.personId()).subscribe({
      next: (list) => {
        this.docs.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.errorKey.set(null);

    // Client hints — the backend re-checks by magic bytes and rejects SVG regardless.
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      this.errorKey.set('documents.svgRejected');
      return;
    }
    if (file.size > DOCUMENT_MAX_BYTES) {
      this.errorKey.set('documents.tooLarge');
      return;
    }

    this.uploading.set(true);
    this.service.upload(file, this.personId()).subscribe({
      next: () => {
        this.uploading.set(false);
        this.messages.add({ severity: 'success', detail: this.i18n.instant('documents.uploaded') });
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.uploading.set(false);
        const body = err.error as ApiErrorBody | undefined;
        this.errorKey.set(body?.messageKey ?? 'documents.uploadFailed');
      },
    });
  }

  confirmDelete(doc: DocumentWithUrl): void {
    this.confirm.confirm({
      message: this.i18n.instant('documents.deleteConfirm'),
      header: this.i18n.instant('actions.delete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.service.remove(doc.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', detail: this.i18n.instant('documents.deleted') });
            this.reload();
          },
          error: () => this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') }),
        });
      },
    });
  }
}

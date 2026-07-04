import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ViewRequestService } from '../../core/services/view-request.service';
import { LanguageService } from '../../core/services/language.service';
import type { ApiErrorBody, CreateViewRequestDto } from '../../core/models';

/**
 * Public, unauthenticated tree-view request form. Reachable at `/request-view` (slug entered
 * by the user) or `/t/:tenantSlug/request-view` (slug from the URL). Lives OUTSIDE the authed
 * shell/guards. The ID attachment is optional here; the backend enforces `requireIdForViewRequest`.
 */
@Component({
  selector: 'app-public-view-request',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputTextModule, TextareaModule, ButtonModule, MessageModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div class="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <div class="mb-6 flex items-center justify-between">
          <h1 class="text-lg font-semibold text-tribe">{{ 'viewRequests.publicTitle' | translate }}</h1>
          <button type="button" class="text-sm text-gray-500 hover:text-tribe" (click)="lang.toggle()">
            {{ lang.isRtl() ? 'EN' : 'ع' }}
          </button>
        </div>

        @if (done()) {
          <div class="flex flex-col items-center gap-3 py-6 text-center">
            <i class="pi pi-check-circle text-4xl text-green-600"></i>
            <p class="text-gray-700">{{ 'viewRequests.publicDone' | translate }}</p>
          </div>
        } @else {
          <p class="mb-6 text-sm text-gray-500">{{ 'viewRequests.publicSubtitle' | translate }}</p>

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
            @if (!tenantSlug()) {
              <label class="flex flex-col gap-1">
                <span class="text-sm text-gray-700">{{ 'viewRequests.fields.tenantSlug' | translate }} *</span>
                <input pInputText formControlName="tenantSlug" [attr.dir]="'ltr'" class="w-full" />
              </label>
            }

            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700">{{ 'viewRequests.fields.fullName' | translate }} *</span>
              <input pInputText formControlName="fullName" class="w-full" />
              <small class="text-gray-400">{{ 'viewRequests.hints.tripleName' | translate }}</small>
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700">{{ 'viewRequests.fields.phone' | translate }} *</span>
              <input pInputText formControlName="phone" [attr.dir]="'ltr'" class="w-full" />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700">{{ 'viewRequests.fields.allegedBranch' | translate }}</span>
              <input pInputText formControlName="allegedBranch" class="w-full" />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700">{{ 'viewRequests.fields.reason' | translate }} *</span>
              <textarea pTextarea formControlName="reason" rows="3" class="w-full"></textarea>
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700">{{ 'viewRequests.fields.idAttachment' | translate }}</span>
              <input type="file" accept="image/*,application/pdf" (change)="onFile($event)" class="text-sm" />
              <small class="text-gray-400">{{ 'viewRequests.hints.idAttachment' | translate }}</small>
            </label>

            @if (errorKey()) {
              <p-message severity="error" [text]="errorKey()! | translate" />
            }

            <p-button
              type="submit"
              [label]="'viewRequests.submit' | translate"
              [loading]="submitting()"
              [disabled]="form.invalid || submitting()"
              styleClass="w-full"
            />
          </form>
        }
      </div>
    </div>
  `,
})
export class PublicViewRequestComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ViewRequestService);
  readonly lang = inject(LanguageService);

  /** Route param when reached via /t/:tenantSlug/request-view. */
  readonly tenantSlug = input<string>();

  readonly submitting = signal(false);
  readonly done = signal(false);
  readonly errorKey = signal<string | null>(null);
  private file: File | null = null;

  readonly form = this.fb.nonNullable.group({
    tenantSlug: [''],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required]],
    allegedBranch: [''],
    reason: ['', [Validators.required]],
  });

  /** slug comes from the route param if present, otherwise from the form field. */
  private readonly effectiveSlug = computed(() => this.tenantSlug());

  onFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const slug = (this.effectiveSlug() || v.tenantSlug).trim();
    if (!slug) {
      // Only required when no slug is present in the URL.
      this.errorKey.set('viewRequests.slugRequired');
      return;
    }
    this.submitting.set(true);
    this.errorKey.set(null);

    const base: CreateViewRequestDto = {
      tenantSlug: slug,
      fullName: v.fullName.trim(),
      phone: v.phone.trim(),
      allegedBranch: v.allegedBranch.trim() || undefined,
      reason: v.reason.trim(),
    };

    if (this.file) {
      // Upload the optional ID first, then submit with the returned key.
      this.service.uploadIdAttachment(slug, this.file).subscribe({
        next: (ticket) => this.create({ ...base, idAttachmentKey: ticket.idAttachmentKey }),
        error: (err: HttpErrorResponse) => this.onError(err),
      });
    } else {
      this.create(base);
    }
  }

  private create(dto: CreateViewRequestDto): void {
    this.service.createPublic(dto).subscribe({
      next: () => {
        this.submitting.set(false);
        this.done.set(true);
      },
      error: (err: HttpErrorResponse) => this.onError(err),
    });
  }

  private onError(err: HttpErrorResponse): void {
    this.submitting.set(false);
    const body = err.error as ApiErrorBody | undefined;
    this.errorKey.set(body?.messageKey ?? 'errors.generic');
  }
}

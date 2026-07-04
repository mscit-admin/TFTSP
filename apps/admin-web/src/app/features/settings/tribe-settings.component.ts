import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { TenantSettingsService } from '../../core/services/tenant-settings.service';
import { AuthService } from '../../core/services/auth.service';
import type { Tenant } from '../../core/models';

@Component({
  selector: 'app-tribe-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    InputTextModule,
    ColorPickerModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="mb-4 text-xl font-semibold text-gray-800">{{ 'settings.title' | translate }}</h1>

      @if (!canWrite()) {
        <p-message severity="warn" [text]="'nav.readOnlyNotice' | translate" styleClass="mb-4" />
      }

      <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-5">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'settings.fields.nameAr' | translate }}</span>
            <input pInputText formControlName="nameAr" [attr.dir]="'rtl'" class="w-full" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'settings.fields.nameEn' | translate }}</span>
            <input pInputText formControlName="nameEn" [attr.dir]="'ltr'" class="w-full" />
          </label>
        </div>

        <!-- Logo (upload stubbed to API shape) -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-gray-700">{{ 'settings.fields.logo' | translate }}</span>
          <div class="flex items-center gap-3">
            <div
              class="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400"
            >
              @if (logoKey()) {
                <i class="pi pi-image text-2xl"></i>
              } @else {
                <i class="pi pi-cloud-upload text-2xl"></i>
              }
            </div>
            <div class="flex flex-col gap-1">
              <input
                type="file"
                accept="image/png,image/jpeg"
                [disabled]="!canWrite()"
                (change)="onLogoSelected($event)"
                class="text-sm"
              />
              <small class="text-gray-400">{{ 'settings.hints.logoStub' | translate }}</small>
              @if (logoKey()) {
                <small class="text-gray-500">{{ 'settings.fields.logoKey' | translate }}: {{ logoKey() }}</small>
              }
            </div>
          </div>
        </div>

        <!-- Colors -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'settings.fields.primaryColor' | translate }}</span>
            <div class="flex items-center gap-2">
              <p-colorpicker formControlName="primaryColor" (onChange)="previewPrimary()" />
              <input
                pInputText
                formControlName="primaryColor"
                [attr.dir]="'ltr'"
                class="w-32"
                (input)="previewPrimary()"
              />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{
              'settings.fields.secondaryColor' | translate
            }}</span>
            <div class="flex items-center gap-2">
              <p-colorpicker formControlName="secondaryColor" />
              <input pInputText formControlName="secondaryColor" [attr.dir]="'ltr'" class="w-32" />
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <p-button
            type="submit"
            [label]="'actions.save' | translate"
            [loading]="saving()"
            [disabled]="form.invalid || saving() || !canWrite()"
          />
        </div>
      </form>
    </div>
  `,
})
export class TribeSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TenantSettingsService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly canWrite = this.auth.canWrite;
  readonly saving = signal(false);
  readonly logoKey = signal<string | null>(null);

  private normalizeColor(value: string | null | undefined): string {
    if (!value) return '#0f766e';
    return value.startsWith('#') ? value : `#${value}`;
  }

  readonly form = this.fb.nonNullable.group({
    nameAr: ['', [Validators.required]],
    nameEn: ['', [Validators.required]],
    primaryColor: ['#0f766e'],
    secondaryColor: ['#1f2937'],
  });

  constructor() {
    this.service.get().subscribe({
      next: (t: Tenant) => {
        this.logoKey.set(t.logoKey ?? null);
        this.form.patchValue({
          nameAr: t.nameAr,
          nameEn: t.nameEn,
          primaryColor: this.normalizeColor(t.primaryColor),
        });
        this.previewPrimary();
      },
      error: () => this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') }),
    });
  }

  previewPrimary(): void {
    const color = this.normalizeColor(this.form.controls.primaryColor.value);
    document.documentElement.style.setProperty('--tribe-primary', color);
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    // Stub flow: request a ticket, then (M4) PUT the file to ticket.uploadUrl.
    this.service.requestLogoUpload(file.type).subscribe({
      next: (ticket) => {
        this.logoKey.set(ticket.logoKey);
        this.messages.add({ severity: 'info', detail: this.i18n.instant('settings.logoStaged') });
      },
      error: () =>
        this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') }),
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
      .update({
        nameAr: v.nameAr,
        nameEn: v.nameEn,
        primaryColor: this.normalizeColor(v.primaryColor),
        secondaryColor: this.normalizeColor(v.secondaryColor),
        logoKey: this.logoKey(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.previewPrimary();
          this.messages.add({ severity: 'success', detail: this.i18n.instant('settings.saved') });
        },
        error: () => {
          this.saving.set(false);
          this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
        },
      });
  }
}

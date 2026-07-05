import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { VisibilityService } from '../../core/services/visibility.service';
import {
  MEMBER_SCOPES,
  VISIBILITY_LEVELS,
  WOMEN_DISPLAY_MODES,
} from '../../core/models';
import type { VisibilitySettings } from '../../core/models';

interface ToggleField {
  control: 'showPhotos' | 'showPhones' | 'showBirthDates' | 'showDeceased' | 'showMinors' | 'showDocuments';
  labelKey: string;
  hintKey: string;
}

@Component({
  selector: 'app-visibility-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    SelectModule,
    ToggleSwitchModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="mb-1 text-xl font-semibold text-gray-800">{{ 'visibility.title' | translate }}</h1>
      <p class="mb-6 text-sm text-gray-500">{{ 'visibility.subtitle' | translate }}</p>

      <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-6">
        <!-- Baseline level -->
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{{ 'visibility.fields.level' | translate }}</span>
          <p-select
            formControlName="level"
            [options]="levelOptions"
            optionValue="value"
            styleClass="w-full sm:w-80"
          >
            <ng-template let-o pTemplate="selectedItem">{{ o.labelKey | translate }}</ng-template>
            <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
          </p-select>
          <small class="text-gray-400">{{ 'visibility.hints.level' | translate }}</small>
        </label>

        <!-- Women display -->
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{{ 'visibility.fields.womenDisplay' | translate }}</span>
          <p-select
            formControlName="womenDisplay"
            [options]="womenOptions"
            optionValue="value"
            styleClass="w-full sm:w-80"
          >
            <ng-template let-o pTemplate="selectedItem">{{ o.labelKey | translate }}</ng-template>
            <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
          </p-select>
          <small class="text-gray-400">{{ 'visibility.hints.womenDisplay' | translate }}</small>
        </label>

        <!-- Default member scope -->
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{{ 'visibility.fields.defaultMemberScope' | translate }}</span>
          <p-select
            formControlName="defaultMemberScope"
            [options]="scopeOptions"
            optionValue="value"
            styleClass="w-full sm:w-80"
          >
            <ng-template let-o pTemplate="selectedItem">{{ o.labelKey | translate }}</ng-template>
            <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
          </p-select>
          <small class="text-gray-400">{{ 'visibility.hints.defaultMemberScope' | translate }}</small>
        </label>

        <!-- Field toggles -->
        <fieldset class="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
          <legend class="px-1 text-sm font-medium text-gray-700">
            {{ 'visibility.fieldPoliciesTitle' | translate }}
          </legend>
          @for (t of toggles; track t.control) {
            <div class="flex items-start gap-3">
              <p-toggleswitch [formControlName]="t.control" [inputId]="t.control" />
              <label [for]="t.control" class="flex flex-col">
                <span class="text-sm text-gray-700">{{ t.labelKey | translate }}</span>
                <span class="text-xs text-gray-400">{{ t.hintKey | translate }}</span>
              </label>
            </div>
          }
        </fieldset>

        <!-- View-request policy -->
        <div class="flex items-start gap-3">
          <p-toggleswitch formControlName="requireIdForViewRequest" inputId="requireId" />
          <label for="requireId" class="flex flex-col">
            <span class="text-sm text-gray-700">{{ 'visibility.fields.requireIdForViewRequest' | translate }}</span>
            <span class="text-xs text-gray-400">{{ 'visibility.hints.requireIdForViewRequest' | translate }}</span>
          </label>
        </div>

        <div>
          <p-button
            type="submit"
            [label]="'actions.save' | translate"
            [loading]="saving()"
            [disabled]="form.invalid || saving()"
          />
        </div>
      </form>
    </div>
  `,
})
export class VisibilitySettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(VisibilityService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly saving = signal(false);

  readonly levelOptions = VISIBILITY_LEVELS.map((v) => ({ value: v, labelKey: `visibility.level.${v}` }));
  readonly womenOptions = WOMEN_DISPLAY_MODES.map((v) => ({ value: v, labelKey: `visibility.women.${v}` }));
  readonly scopeOptions = MEMBER_SCOPES.map((v) => ({ value: v, labelKey: `visibility.scope.${v}` }));

  readonly toggles: ToggleField[] = [
    { control: 'showPhotos', labelKey: 'visibility.fields.showPhotos', hintKey: 'visibility.hints.showPhotos' },
    { control: 'showPhones', labelKey: 'visibility.fields.showPhones', hintKey: 'visibility.hints.showPhones' },
    { control: 'showBirthDates', labelKey: 'visibility.fields.showBirthDates', hintKey: 'visibility.hints.showBirthDates' },
    { control: 'showDeceased', labelKey: 'visibility.fields.showDeceased', hintKey: 'visibility.hints.showDeceased' },
    { control: 'showMinors', labelKey: 'visibility.fields.showMinors', hintKey: 'visibility.hints.showMinors' },
    { control: 'showDocuments', labelKey: 'visibility.fields.showDocuments', hintKey: 'visibility.hints.showDocuments' },
  ];

  readonly form = this.fb.nonNullable.group({
    level: ['members' as VisibilitySettings['level'], [Validators.required]],
    womenDisplay: ['under_father' as VisibilitySettings['womenDisplay'], [Validators.required]],
    defaultMemberScope: ['direct' as VisibilitySettings['defaultMemberScope'], [Validators.required]],
    showPhotos: [true],
    showPhones: [false],
    showBirthDates: [true],
    showDeceased: [true],
    showMinors: [false],
    showDocuments: [false],
    requireIdForViewRequest: [false],
  });

  constructor() {
    this.service.get().subscribe({
      next: (s: VisibilitySettings) =>
        this.form.patchValue({
          level: s.level,
          womenDisplay: s.womenDisplay,
          defaultMemberScope: s.defaultMemberScope,
          showPhotos: s.showPhotos,
          showPhones: s.showPhones,
          showBirthDates: s.showBirthDates,
          showDeceased: s.showDeceased,
          showMinors: s.showMinors,
          showDocuments: s.showDocuments,
          requireIdForViewRequest: s.requireIdForViewRequest,
        }),
      error: () => this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') }),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.service.update(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', detail: this.i18n.instant('visibility.saved') });
      },
      error: () => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
      },
    });
  }
}

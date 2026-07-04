import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { WorkflowSettingsService } from '../../core/services/workflow-settings.service';
import type { WorkflowSettings } from '../../core/models';

@Component({
  selector: 'app-workflow-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    SelectModule,
    InputNumberModule,
    ToggleSwitchModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div class="mx-auto max-w-xl">
      <h1 class="mb-4 text-xl font-semibold text-gray-800">{{ 'workflow.title' | translate }}</h1>
      <p class="mb-6 text-sm text-gray-500">{{ 'workflow.subtitle' | translate }}</p>

      <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-5">
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'workflow.fields.approvalsRequired' | translate }}</span>
          <p-select
            formControlName="approvalsRequired"
            [options]="approvalOptions"
            optionLabel="label"
            optionValue="value"
            styleClass="w-40"
          />
          <small class="text-gray-400">{{ 'workflow.hints.approvalsRequired' | translate }}</small>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'workflow.fields.expiryDays' | translate }}</span>
          <p-inputnumber formControlName="expiryDays" [min]="1" [max]="365" [showButtons]="true" />
          <small class="text-gray-400">{{ 'workflow.hints.expiryDays' | translate }}</small>
        </label>

        <div class="flex items-center gap-3">
          <p-toggleswitch formControlName="reviewerCanEdit" inputId="reviewerCanEdit" />
          <label for="reviewerCanEdit" class="text-sm text-gray-700">{{
            'workflow.fields.reviewerCanEdit' | translate
          }}</label>
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
export class WorkflowSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(WorkflowSettingsService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly saving = signal(false);

  readonly approvalOptions = [1, 2, 3].map((n) => ({ value: n, label: String(n) }));

  readonly form = this.fb.nonNullable.group({
    approvalsRequired: [1, [Validators.required, Validators.min(1), Validators.max(3)]],
    expiryDays: [30, [Validators.required, Validators.min(1)]],
    reviewerCanEdit: [false],
  });

  constructor() {
    this.service.get().subscribe({
      next: (s: WorkflowSettings) =>
        this.form.patchValue({
          approvalsRequired: s.approvalsRequired,
          expiryDays: s.expiryDays,
          reviewerCanEdit: s.reviewerCanEdit,
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
        this.messages.add({ severity: 'success', detail: this.i18n.instant('workflow.saved') });
      },
      error: () => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
      },
    });
  }
}

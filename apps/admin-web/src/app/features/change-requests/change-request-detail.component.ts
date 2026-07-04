import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ChangeRequestService } from '../../core/services/change-request.service';
import { PersonService } from '../../core/services/person.service';
import { AuthService } from '../../core/services/auth.service';
import { crStatusKey, crStatusSeverity } from '../../core/util/cr-status';
import { patchToDiffRows, formatDiffValue } from '../../core/util/patch-diff';
import { OWNER_EDITABLE_STATUSES } from '../../core/models';
import type {
  ApiErrorBody,
  ChangeRequest,
  JsonPatchOp,
  ReviewDecision,
} from '../../core/models';

interface EditRow {
  op: JsonPatchOp['op'];
  path: string;
  field: string;
  type: 'bool' | 'num' | 'text';
  value: string | number | boolean;
}

@Component({
  selector: 'app-change-request-detail',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    TagModule,
    ButtonModule,
    SelectModule,
    TextareaModule,
    InputTextModule,
    CheckboxModule,
    MessageModule,
  ],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-5">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'changeRequests.detailTitle' | translate }}</h1>
        <p-button
          icon="pi pi-arrow-left"
          [text]="true"
          severity="secondary"
          [ariaLabel]="'actions.back' | translate"
          (onClick)="back()"
        />
      </div>

      @if (cr(); as c) {
        <!-- Meta -->
        <div class="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm md:grid-cols-4">
          <div>
            <div class="text-gray-400">{{ 'changeRequests.fields.target' | translate }}</div>
            <div>{{ 'changeRequests.target.' + c.targetType | translate }}</div>
          </div>
          <div>
            <div class="text-gray-400">{{ 'changeRequests.fields.operation' | translate }}</div>
            <div>{{ 'changeRequests.operation.' + c.operation | translate }}</div>
          </div>
          <div>
            <div class="text-gray-400">{{ 'changeRequests.fields.status' | translate }}</div>
            <p-tag [value]="statusKey(c.status) | translate" [severity]="statusSeverity(c.status)" />
          </div>
          <div>
            <div class="text-gray-400">{{ 'changeRequests.fields.expires' | translate }}</div>
            <div [attr.dir]="'ltr'" class="text-start">{{ c.expiresAt | date: 'short' }}</div>
          </div>
        </div>

        @if (c.status === 'conflict') {
          <p-message severity="error" [text]="'changeRequests.conflictNotice' | translate" />
        }

        <!-- Diff -->
        <section class="rounded-lg border border-gray-200 bg-white p-4">
          <h2 class="mb-3 font-medium text-gray-700">{{ 'changeRequests.diffTitle' | translate }}</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-gray-400">
                  <th class="p-2 text-start">{{ 'changeRequests.diff.field' | translate }}</th>
                  <th class="p-2 text-start">{{ 'changeRequests.diff.old' | translate }}</th>
                  <th class="p-2 text-start">{{ 'changeRequests.diff.new' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of diffRows(); track row.field) {
                  <tr class="border-t border-gray-100">
                    <td class="p-2 font-medium">{{ fieldLabel(row.field) }}</td>
                    <td class="p-2 text-gray-500">{{ fmt(row.oldValue) }}</td>
                    <td class="p-2">
                      @if (row.op === 'remove') {
                        <span class="text-red-600">{{ 'changeRequests.diff.removed' | translate }}</span>
                      } @else {
                        <span class="text-tribe">{{ fmt(row.newValue) }}</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <!-- Owner editor (draft / changes_requested / conflict) -->
        @if (canOwnerEdit()) {
          <section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 class="mb-3 font-medium text-amber-800">{{ 'changeRequests.editPatchTitle' | translate }}</h2>
            <div class="flex flex-col gap-3">
              @for (r of editRows(); track r.path) {
                <div class="flex items-center gap-3">
                  <label class="w-40 text-sm text-gray-700">{{ fieldLabel(r.field) }}</label>
                  @if (r.op === 'remove') {
                    <span class="text-sm text-red-600">{{ 'changeRequests.diff.removed' | translate }}</span>
                  } @else if (r.type === 'bool') {
                    <p-checkbox [(ngModel)]="r.value" [binary]="true" />
                  } @else if (r.type === 'num') {
                    <input pInputText type="number" [(ngModel)]="r.value" [attr.dir]="'ltr'" class="w-48" />
                  } @else {
                    <input pInputText [(ngModel)]="r.value" class="w-64" />
                  }
                </div>
              }
            </div>
            <div class="mt-4 flex gap-2">
              <p-button
                [label]="'changeRequests.saveDraft' | translate"
                severity="secondary"
                [loading]="saving()"
                (onClick)="saveDraft()"
              />
              <p-button
                [label]="'changeRequests.resubmit' | translate"
                [loading]="saving()"
                (onClick)="resubmit()"
              />
            </div>
          </section>
        }

        <!-- Reviewer panel (submitted / under_review, not own request) -->
        @if (canReviewThis()) {
          <section class="rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="mb-3 font-medium text-gray-700">{{ 'changeRequests.reviewTitle' | translate }}</h2>
            <div class="flex flex-col gap-3">
              <p-select
                [options]="decisionOptions"
                [(ngModel)]="decision"
                optionValue="value"
                styleClass="w-64"
              >
                <ng-template let-o pTemplate="selectedItem">{{ o.labelKey | translate }}</ng-template>
                <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
              </p-select>
              <textarea
                pTextarea
                [(ngModel)]="comment"
                rows="3"
                [placeholder]="'changeRequests.commentPlaceholder' | translate"
                class="w-full"
              ></textarea>
              <div>
                <p-button
                  [label]="'changeRequests.submitReview' | translate"
                  [loading]="saving()"
                  [disabled]="!decision"
                  (onClick)="submitReview()"
                />
              </div>
            </div>
          </section>
        }

        <!-- Reviews history -->
        @if (c.reviews.length) {
          <section class="rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="mb-3 font-medium text-gray-700">{{ 'changeRequests.reviewsTitle' | translate }}</h2>
            <ul class="flex flex-col gap-2">
              @for (rv of c.reviews; track rv.id) {
                <li class="flex items-start gap-2 border-b border-gray-100 pb-2 text-sm">
                  <p-tag
                    [value]="'changeRequests.decision.' + rv.decision | translate"
                    [severity]="rv.decision === 'approve' ? 'success' : rv.decision === 'reject' ? 'danger' : 'warn'"
                  />
                  <div class="flex-1">
                    @if (rv.comment) {
                      <div>{{ rv.comment }}</div>
                    }
                    <div class="text-xs text-gray-400" [attr.dir]="'ltr'">{{ rv.createdAt | date: 'short' }}</div>
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      } @else if (loading()) {
        <p class="text-gray-400">{{ 'common.loading' | translate }}</p>
      } @else {
        <p class="text-gray-400">{{ 'changeRequests.notFound' | translate }}</p>
      }
    </div>
  `,
})
export class ChangeRequestDetailComponent {
  private readonly service = inject(ChangeRequestService);
  private readonly personService = inject(PersonService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly id = input<string>();

  readonly cr = signal<ChangeRequest | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  private readonly target = signal<Record<string, unknown> | undefined>(undefined);
  readonly editRows = signal<EditRow[]>([]);

  decision: ReviewDecision | null = null;
  comment = '';

  readonly decisionOptions = (['approve', 'request_changes', 'reject'] as ReviewDecision[]).map((d) => ({
    value: d,
    labelKey: `changeRequests.decision.${d}`,
  }));

  readonly diffRows = computed(() => {
    const c = this.cr();
    return c ? patchToDiffRows(c.patch, this.target()) : [];
  });

  private readonly isOwner = computed(() => {
    const c = this.cr();
    return !!c && c.createdBy === this.auth.userId();
  });

  readonly canOwnerEdit = computed(() => {
    const c = this.cr();
    if (!c || !this.isOwner()) return false;
    return OWNER_EDITABLE_STATUSES.includes(c.status) || c.status === 'conflict';
  });

  readonly canReviewThis = computed(() => {
    const c = this.cr();
    if (!c || this.isOwner() || !this.auth.canReview()) return false;
    return c.status === 'submitted' || c.status === 'under_review';
  });

  constructor() {
    queueMicrotask(() => {
      const id = this.id();
      if (id) this.load(id);
      else this.loading.set(false);
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.service.get(id).subscribe({
      next: (c) => {
        this.cr.set(c);
        this.loading.set(false);
        this.buildEditRows(c);
        // Resolve old values for person targets (update ops).
        if (c.targetType === 'person' && c.targetId) {
          this.personService.get(c.targetId).subscribe({
            next: (p) => this.target.set(p as unknown as Record<string, unknown>),
            error: () => void 0,
          });
        }
      },
      error: () => {
        this.cr.set(null);
        this.loading.set(false);
      },
    });
  }

  private buildEditRows(c: ChangeRequest): void {
    this.editRows.set(
      c.patch.map((op) => {
        const field = op.path.replace(/^\//, '').replace(/\//g, '.');
        let type: EditRow['type'] = 'text';
        let value: string | number | boolean = '';
        if (op.op !== 'remove') {
          if (typeof op.value === 'boolean') {
            type = 'bool';
            value = op.value;
          } else if (typeof op.value === 'number') {
            type = 'num';
            value = op.value;
          } else {
            type = 'text';
            value = op.value == null ? '' : String(op.value);
          }
        }
        return { op: op.op, path: op.path, field, type, value };
      }),
    );
  }

  private rowsToPatch(): JsonPatchOp[] {
    return this.editRows().map((r) => {
      if (r.op === 'remove') return { op: 'remove', path: r.path };
      let value: unknown = r.value;
      if (r.type === 'num') value = Number(r.value);
      return { op: r.op, path: r.path, value };
    });
  }

  saveDraft(): void {
    this.persist().subscribe({
      next: (c) => {
        this.cr.set(c);
        this.saving.set(false);
        this.messages.add({ severity: 'success', detail: this.i18n.instant('changeRequests.saved') });
      },
      error: (err: HttpErrorResponse) => this.onError(err),
    });
  }

  resubmit(): void {
    const id = this.id();
    if (!id) return;
    this.persist().subscribe({
      next: () => {
        this.service.submit(id).subscribe({
          next: () => {
            this.saving.set(false);
            this.messages.add({ severity: 'success', detail: this.i18n.instant('changeRequests.resubmitted') });
            this.router.navigate(['/my-requests']);
          },
          error: (err: HttpErrorResponse) => this.onError(err),
        });
      },
      error: (err: HttpErrorResponse) => this.onError(err),
    });
  }

  private persist() {
    const id = this.id()!;
    this.saving.set(true);
    return this.service.update(id, { patch: this.rowsToPatch() });
  }

  submitReview(): void {
    const id = this.id();
    if (!id || !this.decision) return;
    this.saving.set(true);
    this.service.review(id, { decision: this.decision, comment: this.comment || undefined }).subscribe({
      next: (c) => {
        this.cr.set(c);
        this.saving.set(false);
        this.decision = null;
        this.comment = '';
        this.messages.add({ severity: 'success', detail: this.i18n.instant('changeRequests.reviewSubmitted') });
      },
      error: (err: HttpErrorResponse) => this.onError(err),
    });
  }

  private onError(err: HttpErrorResponse): void {
    this.saving.set(false);
    const body = err.error as ApiErrorBody | undefined;
    this.messages.add({
      severity: 'error',
      detail: this.i18n.instant(body?.messageKey ?? 'errors.generic'),
    });
  }

  fieldLabel(field: string): string {
    const key = `crFields.${field}`;
    const label = this.i18n.instant(key);
    return label === key ? field : label;
  }

  fmt = formatDiffValue;
  statusSeverity = crStatusSeverity;
  statusKey = crStatusKey;
  back(): void {
    this.router.navigate(['/change-requests']);
  }
}

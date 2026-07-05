import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ViewRequestService } from '../../core/services/view-request.service';
import type { ViewRequest, ViewRequestStatus } from '../../core/models';

@Component({
  selector: 'app-view-requests',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    TableModule,
    TagModule,
    ButtonModule,
    SelectModule,
    DialogModule,
    DatePickerModule,
    MessageModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'viewRequests.title' | translate }}</h1>
        <div class="flex items-center gap-2">
          <p-select
            [options]="statusOptions"
            [(ngModel)]="statusFilter"
            optionValue="value"
            [showClear]="true"
            [placeholder]="'viewRequests.filterStatus' | translate"
            styleClass="w-52"
            (onChange)="reload()"
            (onClear)="reload()"
          >
            <ng-template let-o pTemplate="selectedItem">{{ o.labelKey | translate }}</ng-template>
            <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
          </p-select>
          <p-button icon="pi pi-refresh" [text]="true" size="small" (onClick)="reload()" />
        </div>
      </div>

      <p-table
        [value]="requests()"
        [loading]="loading()"
        [paginator]="requests().length > 10"
        [rows]="10"
        dataKey="id"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'viewRequests.fields.fullName' | translate }}</th>
            <th>{{ 'viewRequests.fields.phone' | translate }}</th>
            <th>{{ 'viewRequests.fields.allegedBranch' | translate }}</th>
            <th>{{ 'viewRequests.fields.reason' | translate }}</th>
            <th class="text-center">{{ 'viewRequests.fields.idAttachment' | translate }}</th>
            <th>{{ 'viewRequests.fields.status' | translate }}</th>
            <th class="w-44"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-r>
          <tr>
            <td>{{ r.fullName }}</td>
            <td [attr.dir]="'ltr'" class="text-start">{{ r.phone }}</td>
            <td>{{ r.allegedBranch || '—' }}</td>
            <td class="max-w-xs truncate" [title]="r.reason">{{ r.reason }}</td>
            <td class="text-center">
              @if (r.idAttachmentKey) {
                <i class="pi pi-paperclip text-tribe" [title]="'viewRequests.idAttached' | translate"></i>
              } @else {
                <span class="text-gray-300">—</span>
              }
            </td>
            <td>
              <p-tag [value]="'viewRequests.status.' + r.status | translate" [severity]="severity(r.status)" />
              @if (r.status === 'approved' && r.validTo) {
                <div class="text-xs text-gray-400" [attr.dir]="'ltr'">
                  {{ 'viewRequests.until' | translate }}: {{ r.validTo | date: 'mediumDate' }}
                </div>
              }
            </td>
            <td>
              @if (r.status === 'pending') {
                <div class="flex gap-1">
                  <p-button
                    [label]="'viewRequests.approve' | translate"
                    size="small"
                    severity="success"
                    (onClick)="openApprove(r)"
                  />
                  <p-button
                    [label]="'viewRequests.reject' | translate"
                    size="small"
                    severity="danger"
                    [text]="true"
                    (onClick)="confirmReject(r)"
                  />
                </div>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="7" class="py-8 text-center text-gray-400">{{ 'viewRequests.empty' | translate }}</td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Approve dialog: mandatory, non-past expiry -->
    <p-dialog
      [visible]="approveOpen()"
      (visibleChange)="approveOpen.set($event)"
      [modal]="true"
      [style]="{ width: '26rem' }"
      [header]="'viewRequests.approveTitle' | translate"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm text-gray-600">{{ 'viewRequests.approveBody' | translate }}</p>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'viewRequests.validTo' | translate }} *</span>
          <p-datepicker
            [(ngModel)]="validTo"
            [minDate]="minDate"
            dateFormat="yy-mm-dd"
            [showIcon]="true"
            appendTo="body"
            styleClass="w-full"
          />
          <small class="text-gray-400">{{ 'viewRequests.validToHint' | translate }}</small>
        </label>
        @if (approveError()) {
          <p-message severity="error" [text]="'viewRequests.validToRequired' | translate" />
        }
        <div class="flex justify-end gap-2">
          <p-button
            [label]="'actions.cancel' | translate"
            severity="secondary"
            [text]="true"
            (onClick)="approveOpen.set(false)"
          />
          <p-button
            [label]="'viewRequests.approve' | translate"
            severity="success"
            [loading]="acting()"
            (onClick)="confirmApprove()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class ViewRequestsComponent {
  private readonly service = inject(ViewRequestService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly requests = signal<ViewRequest[]>([]);
  readonly loading = signal(false);
  readonly acting = signal(false);
  readonly approveOpen = signal(false);
  readonly approveError = signal(false);

  statusFilter: ViewRequestStatus | null = 'pending';
  validTo: Date | null = null;
  readonly minDate = new Date();
  private target: ViewRequest | null = null;

  readonly statusOptions = (['pending', 'approved', 'rejected', 'expired'] as ViewRequestStatus[]).map(
    (s) => ({ value: s, labelKey: `viewRequests.status.${s}` }),
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.service.list(this.statusFilter ?? undefined).subscribe({
      next: (list) => {
        this.requests.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.requests.set([]);
        this.loading.set(false);
      },
    });
  }

  openApprove(r: ViewRequest): void {
    this.target = r;
    this.validTo = null;
    this.approveError.set(false);
    this.approveOpen.set(true);
  }

  confirmApprove(): void {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (!this.validTo || this.validTo < start) {
      this.approveError.set(true);
      return;
    }
    const id = this.target?.id;
    if (!id) return;
    this.acting.set(true);
    this.service.approve(id, { validTo: this.validTo.toISOString() }).subscribe({
      next: () => {
        this.acting.set(false);
        this.approveOpen.set(false);
        this.messages.add({ severity: 'success', detail: this.i18n.instant('viewRequests.approved') });
        this.reload();
      },
      error: () => {
        this.acting.set(false);
        this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
      },
    });
  }

  confirmReject(r: ViewRequest): void {
    this.confirm.confirm({
      message: this.i18n.instant('viewRequests.rejectConfirm'),
      header: this.i18n.instant('viewRequests.reject'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.service.reject(r.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', detail: this.i18n.instant('viewRequests.rejected') });
            this.reload();
          },
          error: () => this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') }),
        });
      },
    });
  }

  severity(status: ViewRequestStatus): 'success' | 'danger' | 'warn' | 'secondary' {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      case 'expired':
        return 'secondary';
      default:
        return 'warn';
    }
  }
}

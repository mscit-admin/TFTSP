import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ChangeRequestService } from '../../core/services/change-request.service';
import { crStatusKey, crStatusSeverity } from '../../core/util/cr-status';
import type { ChangeRequest, ChangeRequestStatus } from '../../core/models';

@Component({
  selector: 'app-review-queue',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TranslatePipe,
    TableModule,
    TagModule,
    ButtonModule,
    SelectModule,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'changeRequests.queueTitle' | translate }}</h1>
        <div class="flex items-center gap-2">
          <p-select
            [options]="statusOptions"
            [(ngModel)]="statusFilter"
            optionValue="value"
            [showClear]="true"
            [placeholder]="'changeRequests.filterStatus' | translate"
            styleClass="w-56"
            (onChange)="reload()"
            (onClear)="reload()"
          >
            <ng-template let-opt pTemplate="selectedItem">{{ opt.labelKey | translate }}</ng-template>
            <ng-template let-opt pTemplate="item">{{ opt.labelKey | translate }}</ng-template>
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
            <th>{{ 'changeRequests.fields.target' | translate }}</th>
            <th>{{ 'changeRequests.fields.operation' | translate }}</th>
            <th>{{ 'changeRequests.fields.requester' | translate }}</th>
            <th>{{ 'changeRequests.fields.status' | translate }}</th>
            <th>{{ 'changeRequests.fields.created' | translate }}</th>
            <th class="w-24"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-cr>
          <tr>
            <td>{{ 'changeRequests.target.' + cr.targetType | translate }}</td>
            <td>{{ 'changeRequests.operation.' + cr.operation | translate }}</td>
            <td class="text-xs text-gray-500" [attr.dir]="'ltr'">{{ shortId(cr.createdBy) }}</td>
            <td>
              <p-tag
                [value]="statusKey(cr.status) | translate"
                [severity]="statusSeverity(cr.status)"
              />
            </td>
            <td [attr.dir]="'ltr'" class="text-start text-sm">{{ cr.createdAt | date: 'short' }}</td>
            <td>
              <p-button
                [label]="'changeRequests.review' | translate"
                size="small"
                [routerLink]="['/change-requests', cr.id]"
              />
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="6" class="py-8 text-center text-gray-400">
              {{ 'changeRequests.queueEmpty' | translate }}
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class ReviewQueueComponent {
  private readonly service = inject(ChangeRequestService);

  readonly requests = signal<ChangeRequest[]>([]);
  readonly loading = signal(false);
  statusFilter: ChangeRequestStatus | null = null;

  readonly statusOptions = (
    [
      'submitted',
      'under_review',
      'changes_requested',
      'approved',
      'published',
      'rejected',
      'conflict',
      'expired',
    ] as ChangeRequestStatus[]
  ).map((s) => ({ value: s, labelKey: crStatusKey(s) }));

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.service
      .list({ queue: true, status: this.statusFilter ?? undefined })
      .subscribe({
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

  statusSeverity = crStatusSeverity;
  statusKey = crStatusKey;
  shortId(id: string): string {
    return id ? id.slice(0, 8) : '—';
  }
}

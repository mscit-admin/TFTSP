import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ChangeRequestService } from '../../core/services/change-request.service';
import { crStatusKey, crStatusSeverity } from '../../core/util/cr-status';
import { OWNER_EDITABLE_STATUSES } from '../../core/models';
import type { ChangeRequest } from '../../core/models';

@Component({
  selector: 'app-my-requests',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslatePipe, TableModule, TagModule, ButtonModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'changeRequests.mineTitle' | translate }}</h1>
        <p-button icon="pi pi-refresh" [text]="true" size="small" (onClick)="reload()" />
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
            <th>{{ 'changeRequests.fields.status' | translate }}</th>
            <th>{{ 'changeRequests.fields.created' | translate }}</th>
            <th class="w-28"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-cr>
          <tr [class.bg-amber-50]="needsAction(cr)">
            <td>{{ 'changeRequests.target.' + cr.targetType | translate }}</td>
            <td>{{ 'changeRequests.operation.' + cr.operation | translate }}</td>
            <td>
              <p-tag [value]="statusKey(cr.status) | translate" [severity]="statusSeverity(cr.status)" />
              @if (needsAction(cr)) {
                <span class="ms-2 text-xs text-amber-700">{{ 'changeRequests.actionNeeded' | translate }}</span>
              }
            </td>
            <td [attr.dir]="'ltr'" class="text-start text-sm">{{ cr.createdAt | date: 'short' }}</td>
            <td>
              <p-button
                [label]="(needsAction(cr) ? 'changeRequests.edit' : 'actions.view') | translate"
                size="small"
                [text]="!needsAction(cr)"
                [routerLink]="['/change-requests', cr.id]"
              />
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" class="py-8 text-center text-gray-400">
              {{ 'changeRequests.mineEmpty' | translate }}
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class MyRequestsComponent {
  private readonly service = inject(ChangeRequestService);

  readonly requests = signal<ChangeRequest[]>([]);
  readonly loading = signal(false);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.service.list({ mine: true }).subscribe({
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

  /** Owner can edit + resubmit when draft/changes_requested; conflict needs a re-draft too. */
  needsAction(cr: ChangeRequest): boolean {
    return OWNER_EDITABLE_STATUSES.includes(cr.status) || cr.status === 'conflict';
  }

  statusSeverity = crStatusSeverity;
  statusKey = crStatusKey;
}

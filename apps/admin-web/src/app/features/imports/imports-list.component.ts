import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ImportService } from '../../core/services/import.service';
import { importStatusSeverity } from '../../core/util/import-status';
import type { ImportBatch } from '../../core/models';

@Component({
  selector: 'app-imports-list',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslatePipe, TableModule, TagModule, ButtonModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'imports.title' | translate }}</h1>
        <p-button
          icon="pi pi-upload"
          [label]="'imports.new' | translate"
          size="small"
          routerLink="/imports/new"
        />
      </div>

      <p-table
        [value]="batches()"
        [lazy]="true"
        (onLazyLoad)="load($event)"
        [paginator]="true"
        [rows]="pageSize"
        [totalRecords]="total()"
        [loading]="loading()"
        dataKey="id"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'imports.fields.filename' | translate }}</th>
            <th>{{ 'imports.fields.status' | translate }}</th>
            <th class="text-center">{{ 'imports.counts.total' | translate }}</th>
            <th class="text-center">{{ 'imports.counts.created' | translate }}</th>
            <th class="text-center">{{ 'imports.counts.error' | translate }}</th>
            <th>{{ 'imports.fields.created' | translate }}</th>
            <th class="w-24"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-b>
          <tr>
            <td class="max-w-xs truncate">{{ b.filename }}</td>
            <td>
              <p-tag [value]="'imports.status.' + b.status | translate" [severity]="severity(b.status)" />
            </td>
            <td class="text-center">{{ b.counts.total }}</td>
            <td class="text-center">{{ b.counts.created }}</td>
            <td class="text-center" [class.text-red-600]="b.counts.error > 0">{{ b.counts.error }}</td>
            <td [attr.dir]="'ltr'" class="text-start text-sm">{{ b.createdAt | date: 'short' }}</td>
            <td>
              <p-button
                [label]="'actions.view' | translate"
                size="small"
                [text]="true"
                [routerLink]="['/imports', b.id]"
              />
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="7" class="py-8 text-center text-gray-400">{{ 'imports.empty' | translate }}</td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class ImportsListComponent {
  private readonly service = inject(ImportService);

  readonly batches = signal<ImportBatch[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly pageSize = 20;

  load(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize;
    const page = Math.floor((event.first ?? 0) / rows) + 1;
    this.loading.set(true);
    this.service.list(page, rows).subscribe({
      next: (res) => {
        this.batches.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.batches.set([]);
        this.loading.set(false);
      },
    });
  }

  severity = importStatusSeverity;
}

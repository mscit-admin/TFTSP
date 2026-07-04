import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { AutoCompleteModule, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { ImportService } from '../../core/services/import.service';
import { PersonService } from '../../core/services/person.service';
import type {
  ApiErrorBody,
  ImportBatch,
  ImportRow,
  ImportRowDecision,
  Person,
  UpdateImportRowDto,
} from '../../core/models';

interface ErrorLine {
  rowNumber: number;
  column: string;
  messageKey: string;
}

@Component({
  selector: 'app-import-preview',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    TableModule,
    TagModule,
    ButtonModule,
    SelectModule,
    CheckboxModule,
    MessageModule,
    AutoCompleteModule,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <!-- Stats -->
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        @for (s of statCards(); track s.key) {
          <div class="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <div class="text-2xl font-semibold" [class]="s.class">{{ s.value }}</div>
            <div class="text-xs text-gray-500">{{ s.key | translate }}</div>
          </div>
        }
      </section>

      <!-- Errors (all at once) -->
      @if (errorTotal() > 0) {
        <section class="rounded-lg border border-red-200 bg-white p-4">
          <h2 class="mb-3 font-medium text-red-700">
            {{ 'imports.preview.errorsTitle' | translate }} ({{ errorTotal() }})
          </h2>
          <p-table
            [value]="errorLines()"
            [lazy]="true"
            (onLazyLoad)="loadErrors($event)"
            [paginator]="true"
            [rows]="rowsPerPage"
            [totalRecords]="errorTotal()"
            [loading]="errorLoading()"
            dataKey="rowNumber"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                <th class="w-24">{{ 'imports.preview.row' | translate }}</th>
                <th class="w-40">{{ 'imports.preview.column' | translate }}</th>
                <th>{{ 'imports.preview.message' | translate }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-e>
              <tr>
                <td [attr.dir]="'ltr'" class="text-start">{{ e.rowNumber }}</td>
                <td>{{ 'imports.columns.' + e.column | translate }}</td>
                <td class="text-red-600">{{ e.messageKey | translate }}</td>
              </tr>
            </ng-template>
          </p-table>
        </section>
      }

      <!-- Duplicate candidates -->
      @if (dupTotal() > 0) {
        <section class="rounded-lg border border-amber-200 bg-white p-4">
          <h2 class="mb-3 font-medium text-amber-700">
            {{ 'imports.preview.duplicatesTitle' | translate }} ({{ dupTotal() }})
          </h2>
          <p-table
            [value]="dupRows()"
            [lazy]="true"
            (onLazyLoad)="loadDuplicates($event)"
            [paginator]="true"
            [rows]="rowsPerPage"
            [totalRecords]="dupTotal()"
            [loading]="dupLoading()"
            dataKey="id"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                <th class="w-20">{{ 'imports.preview.row' | translate }}</th>
                <th>{{ 'imports.preview.name' | translate }}</th>
                <th class="w-24">{{ 'imports.preview.similarity' | translate }}</th>
                <th class="w-40">{{ 'imports.preview.decision' | translate }}</th>
                <th>{{ 'imports.preview.mergeTarget' | translate }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-r>
              <tr>
                <td [attr.dir]="'ltr'" class="text-start">{{ r.rowNumber }}</td>
                <td>{{ r.raw['fullName'] }}</td>
                <td>{{ r.similarity != null ? (r.similarity * 100).toFixed(0) + '%' : '—' }}</td>
                <td>
                  <p-select
                    [options]="decisionOptions"
                    [ngModel]="r.decision"
                    optionValue="value"
                    styleClass="w-full"
                    (onChange)="setDecision(r, $event.value)"
                  >
                    <ng-template let-o pTemplate="selectedItem">{{ o.labelKey | translate }}</ng-template>
                    <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
                  </p-select>
                </td>
                <td>
                  @if (r.decision === 'merge') {
                    <p-autocomplete
                      [ngModel]="mergePick[r.id]"
                      [suggestions]="personSuggestions()"
                      (completeMethod)="searchPerson($event)"
                      (onSelect)="setMergeTarget(r, $event.value)"
                      optionLabel="fullName"
                      [forceSelection]="true"
                      [dropdown]="true"
                      styleClass="w-full"
                      appendTo="body"
                      [placeholder]="'imports.preview.pickTarget' | translate"
                    />
                  } @else {
                    <span class="text-gray-300">—</span>
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        </section>
      }

      <!-- Ambiguous references -->
      @if (ambTotal() > 0) {
        <section class="rounded-lg border border-orange-200 bg-white p-4">
          <h2 class="mb-3 font-medium text-orange-700">
            {{ 'imports.preview.ambiguousTitle' | translate }} ({{ ambTotal() }})
          </h2>
          <p-table
            [value]="ambRows()"
            [lazy]="true"
            (onLazyLoad)="loadAmbiguous($event)"
            [paginator]="true"
            [rows]="rowsPerPage"
            [totalRecords]="ambTotal()"
            [loading]="ambLoading()"
            dataKey="id"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                <th class="w-20">{{ 'imports.preview.row' | translate }}</th>
                <th>{{ 'imports.preview.name' | translate }}</th>
                <th>{{ 'imports.columns.fatherRef' | translate }}</th>
                <th>{{ 'imports.columns.motherRef' | translate }}</th>
                <th class="w-40">{{ 'imports.preview.decision' | translate }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-r>
              <tr>
                <td [attr.dir]="'ltr'" class="text-start">{{ r.rowNumber }}</td>
                <td>{{ r.raw['fullName'] }}</td>
                <td>
                  <p-autocomplete
                    [ngModel]="fatherPick[r.id]"
                    [suggestions]="personSuggestions()"
                    (completeMethod)="searchPerson($event, 'male')"
                    (onSelect)="resolveRef(r, 'resolvedFatherId', $event.value)"
                    optionLabel="fullName"
                    [forceSelection]="true"
                    [dropdown]="true"
                    styleClass="w-full"
                    appendTo="body"
                    [placeholder]="r.raw['fatherRef'] || ('imports.preview.pickPerson' | translate)"
                  />
                </td>
                <td>
                  <p-autocomplete
                    [ngModel]="motherPick[r.id]"
                    [suggestions]="personSuggestions()"
                    (completeMethod)="searchPerson($event, 'female')"
                    (onSelect)="resolveRef(r, 'resolvedMotherId', $event.value)"
                    optionLabel="fullName"
                    [forceSelection]="true"
                    [dropdown]="true"
                    styleClass="w-full"
                    appendTo="body"
                    [placeholder]="r.raw['motherRef'] || ('imports.preview.pickPerson' | translate)"
                  />
                </td>
                <td>
                  <p-select
                    [options]="decisionOptions"
                    [ngModel]="r.decision"
                    optionValue="value"
                    styleClass="w-full"
                    (onChange)="setDecision(r, $event.value)"
                  >
                    <ng-template let-o pTemplate="selectedItem">{{ o.labelKey | translate }}</ng-template>
                    <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
                  </p-select>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </section>
      }

      <!-- Submit -->
      <section class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="mb-3 text-sm text-gray-600">{{ 'imports.preview.workflowNote' | translate }}</p>
        @if (errorTotal() > 0) {
          <div class="mb-3 flex items-center gap-2">
            <p-checkbox [(ngModel)]="partial" [binary]="true" inputId="partial" />
            <label for="partial" class="text-sm text-gray-700">{{
              'imports.preview.partialLabel' | translate
            }}</label>
          </div>
          @if (!partial) {
            <p-message severity="warn" [text]="'imports.preview.errorsBlock' | translate" styleClass="mb-3" />
          }
        }
        <p-button
          [label]="'imports.preview.submit' | translate"
          [loading]="submitting()"
          [disabled]="submitting() || (errorTotal() > 0 && !partial)"
          (onClick)="submit()"
        />
      </section>
    </div>
  `,
})
export class ImportPreviewComponent {
  private readonly service = inject(ImportService);
  private readonly personService = inject(PersonService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly batch = input.required<ImportBatch>();
  readonly submitted = output<ImportBatch>();

  readonly rowsPerPage = 20;
  partial = false;
  readonly submitting = signal(false);

  // Error section
  readonly errorLines = signal<ErrorLine[]>([]);
  readonly errorTotal = signal(0);
  readonly errorLoading = signal(false);

  // Duplicate section
  readonly dupRows = signal<ImportRow[]>([]);
  readonly dupTotal = signal(0);
  readonly dupLoading = signal(false);
  readonly mergePick: Record<string, Person | null> = {};

  // Ambiguous section
  readonly ambRows = signal<ImportRow[]>([]);
  readonly ambTotal = signal(0);
  readonly ambLoading = signal(false);
  readonly fatherPick: Record<string, Person | null> = {};
  readonly motherPick: Record<string, Person | null> = {};

  readonly personSuggestions = signal<Person[]>([]);

  readonly decisionOptions = (['new', 'merge', 'ignore'] as ImportRowDecision[]).map((d) => ({
    value: d,
    labelKey: `imports.decision.${d}`,
  }));

  readonly statCards = computed(() => {
    const c = this.batch().counts;
    return [
      { key: 'imports.counts.total', value: c.total, class: 'text-gray-800' },
      { key: 'imports.counts.valid', value: c.valid, class: 'text-green-600' },
      { key: 'imports.counts.error', value: c.error, class: 'text-red-600' },
      { key: 'imports.counts.duplicateCandidate', value: c.duplicateCandidate, class: 'text-amber-600' },
      { key: 'imports.counts.ambiguous', value: c.ambiguous, class: 'text-orange-600' },
      { key: 'imports.counts.ignored', value: c.ignored, class: 'text-gray-500' },
    ];
  });

  loadErrors(event: TableLazyLoadEvent): void {
    const page = this.pageOf(event);
    this.errorLoading.set(true);
    this.service.rows(this.batch().id, { status: 'error', page, pageSize: this.rowsPerPage }).subscribe({
      next: (res) => {
        const lines: ErrorLine[] = [];
        for (const row of res.data) {
          for (const err of row.errors) {
            lines.push({ rowNumber: row.rowNumber, column: err.column, messageKey: err.messageKey });
          }
        }
        this.errorLines.set(lines);
        this.errorTotal.set(res.total);
        this.errorLoading.set(false);
      },
      error: () => this.errorLoading.set(false),
    });
  }

  loadDuplicates(event: TableLazyLoadEvent): void {
    const page = this.pageOf(event);
    this.dupLoading.set(true);
    this.service
      .rows(this.batch().id, { status: 'duplicate_candidate', page, pageSize: this.rowsPerPage })
      .subscribe({
        next: (res) => {
          this.dupRows.set(res.data);
          this.dupTotal.set(res.total);
          this.dupLoading.set(false);
        },
        error: () => this.dupLoading.set(false),
      });
  }

  loadAmbiguous(event: TableLazyLoadEvent): void {
    const page = this.pageOf(event);
    this.ambLoading.set(true);
    this.service
      .rows(this.batch().id, { status: 'ambiguous', page, pageSize: this.rowsPerPage })
      .subscribe({
        next: (res) => {
          this.ambRows.set(res.data);
          this.ambTotal.set(res.total);
          this.ambLoading.set(false);
        },
        error: () => this.ambLoading.set(false),
      });
  }

  searchPerson(event: AutoCompleteCompleteEvent, gender?: 'male' | 'female'): void {
    this.personService.list({ q: event.query, pageSize: 10 }).subscribe({
      next: (res) => {
        const items = gender ? res.data.filter((p) => p.gender === gender) : res.data;
        this.personSuggestions.set(items);
      },
      error: () => this.personSuggestions.set([]),
    });
  }

  setDecision(row: ImportRow, decision: ImportRowDecision): void {
    this.patchRow(row, { decision }, () => (row.decision = decision));
  }

  setMergeTarget(row: ImportRow, person: Person): void {
    this.mergePick[row.id] = person;
    this.patchRow(row, { mergeTargetId: person.id }, () => (row.mergeTargetId = person.id));
  }

  resolveRef(
    row: ImportRow,
    field: 'resolvedFatherId' | 'resolvedMotherId' | 'resolvedSpouseId',
    person: Person,
  ): void {
    if (field === 'resolvedFatherId') this.fatherPick[row.id] = person;
    if (field === 'resolvedMotherId') this.motherPick[row.id] = person;
    const dto: UpdateImportRowDto = { [field]: person.id };
    this.patchRow(row, dto, () => void 0);
  }

  private patchRow(
    row: ImportRow,
    dto: Parameters<ImportService['updateRow']>[2],
    onOk: () => void,
  ): void {
    this.service.updateRow(this.batch().id, row.id, dto).subscribe({
      next: () => onOk(),
      error: (err: HttpErrorResponse) => {
        const body = err.error as ApiErrorBody | undefined;
        this.messages.add({
          severity: 'error',
          detail: this.i18n.instant(body?.messageKey ?? 'errors.generic'),
        });
      },
    });
  }

  submit(): void {
    this.submitting.set(true);
    this.service.submit(this.batch().id, { partial: this.partial }).subscribe({
      next: (b) => {
        this.submitting.set(false);
        this.messages.add({ severity: 'success', detail: this.i18n.instant('imports.preview.submittedToast') });
        this.submitted.emit(b);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const body = err.error as ApiErrorBody | undefined;
        this.messages.add({
          severity: 'error',
          detail: this.i18n.instant(body?.messageKey ?? 'errors.generic'),
        });
      },
    });
  }

  private pageOf(event: TableLazyLoadEvent): number {
    const rows = event.rows ?? this.rowsPerPage;
    return Math.floor((event.first ?? 0) / rows) + 1;
  }
}

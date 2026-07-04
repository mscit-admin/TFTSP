import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { PersonService } from '../../core/services/person.service';
import { AuthService } from '../../core/services/auth.service';
import type { Person } from '../../core/models';

@Component({
  selector: 'app-persons-list',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'persons.title' | translate }}</h1>
        @if (canWrite()) {
          <p-button
            icon="pi pi-plus"
            [label]="'persons.new' | translate"
            routerLink="/persons/new"
            size="small"
          />
        }
      </div>

      <div class="max-w-md">
        <span class="relative block">
          <i
            class="pi pi-search absolute top-1/2 -translate-y-1/2 text-gray-400 start-3"
          ></i>
          <input
            pInputText
            type="search"
            class="w-full ps-9"
            [placeholder]="'persons.searchPlaceholder' | translate"
            (input)="onSearch($any($event.target).value)"
          />
        </span>
      </div>

      <p-table
        [value]="persons()"
        [lazy]="true"
        (onLazyLoad)="load($event)"
        [paginator]="true"
        [rows]="pageSize"
        [totalRecords]="total()"
        [loading]="loading()"
        [rowsPerPageOptions]="[10, 20, 50]"
        dataKey="id"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'persons.fields.fullName' | translate }}</th>
            <th>{{ 'persons.fields.gender' | translate }}</th>
            <th>{{ 'persons.fields.birthDate' | translate }}</th>
            <th>{{ 'persons.fields.status' | translate }}</th>
            <th class="w-28"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-p>
          <tr>
            <td>
              <a class="text-tribe hover:underline" [routerLink]="['/persons', p.id]">{{
                p.fullName
              }}</a>
              @if (p.laqab) {
                <span class="text-gray-400"> ({{ p.laqab }})</span>
              }
            </td>
            <td>{{ 'persons.genderValue.' + p.gender | translate }}</td>
            <td [attr.dir]="'ltr'" class="text-start">{{ p.birthDate || '—' }}</td>
            <td>
              <p-tag
                [value]="'persons.statusValue.' + p.status | translate"
                [severity]="p.status === 'published' ? 'success' : 'warn'"
              />
            </td>
            <td>
              <div class="flex gap-1">
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  size="small"
                  [routerLink]="['/persons', p.id]"
                  [ariaLabel]="'actions.edit' | translate"
                />
                @if (canWrite()) {
                  <p-button
                    icon="pi pi-trash"
                    severity="danger"
                    [text]="true"
                    size="small"
                    (onClick)="confirmDelete(p)"
                    [ariaLabel]="'actions.delete' | translate"
                  />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" class="py-8 text-center text-gray-400">
              {{ 'persons.empty' | translate }}
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class PersonsListComponent {
  private readonly personService = inject(PersonService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);

  readonly persons = signal<Person[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly pageSize = 20;
  readonly canWrite = this.auth.canWrite;

  private query = '';
  private lastPage = 1;
  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((q) => {
        this.query = q;
        this.fetch(1);
      });
  }

  onSearch(value: string): void {
    this.search$.next(value.trim());
  }

  load(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize;
    const page = Math.floor((event.first ?? 0) / rows) + 1;
    this.fetch(page, rows);
  }

  private fetch(page: number, pageSize = this.pageSize): void {
    this.lastPage = page;
    this.loading.set(true);
    this.personService.list({ q: this.query || undefined, page, pageSize }).subscribe({
      next: (res) => {
        this.persons.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({
          severity: 'error',
          detail: this.tr('errors.generic'),
        });
      },
    });
  }

  confirmDelete(person: Person): void {
    this.confirm.confirm({
      message: this.tr('persons.deleteConfirm'),
      header: this.tr('actions.delete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.personService.remove(person.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', detail: this.tr('persons.deleted') });
            this.fetch(this.lastPage);
          },
          error: () =>
            this.messages.add({ severity: 'error', detail: this.tr('errors.generic') }),
        });
      },
    });
  }

  private tr(key: string): string {
    return this.i18n.instant(key) as string;
  }
}

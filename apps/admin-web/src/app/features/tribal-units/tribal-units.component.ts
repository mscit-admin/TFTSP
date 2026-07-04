import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TribalUnitService } from '../../core/services/tribal-unit.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { CHILD_UNIT_TYPE } from '../../core/models';
import type { TribalUnit, UnitType } from '../../core/models';

@Component({
  selector: 'app-tribal-units',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    TreeModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TagModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">{{ 'tribalUnits.title' | translate }}</h1>
        @if (canWrite()) {
          <p-button
            icon="pi pi-plus"
            [label]="'tribalUnits.addRoot' | translate"
            size="small"
            (onClick)="openCreate(null)"
          />
        }
      </div>

      @if (nodes().length === 0 && !loading()) {
        <p class="text-gray-400">{{ 'tribalUnits.empty' | translate }}</p>
      }

      <p-tree [value]="nodes()" styleClass="w-full">
        <ng-template let-node pTemplate="default">
          <div class="flex w-full items-center justify-between gap-3">
            <span class="flex items-center gap-2">
              <span>{{ lang.isRtl() ? node.data.nameAr : node.data.nameEn }}</span>
              <p-tag
                [value]="'tribalUnits.type.' + node.data.unitType | translate"
                severity="info"
              />
            </span>
            @if (canWrite()) {
              <span class="flex gap-1">
                @if (childType(node.data.unitType)) {
                  <p-button
                    icon="pi pi-plus"
                    [text]="true"
                    size="small"
                    (onClick)="openCreate(node.data)"
                    [ariaLabel]="'tribalUnits.addChild' | translate"
                  />
                }
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  size="small"
                  (onClick)="openEdit(node.data)"
                  [ariaLabel]="'actions.edit' | translate"
                />
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  size="small"
                  (onClick)="confirmDelete(node.data)"
                  [ariaLabel]="'actions.delete' | translate"
                />
              </span>
            }
          </div>
        </ng-template>
      </p-tree>
    </div>

    <p-dialog
      [visible]="dialogOpen()"
      (visibleChange)="dialogOpen.set($event)"
      [modal]="true"
      [style]="{ width: '28rem' }"
      [header]="(editing() ? 'tribalUnits.editTitle' : 'tribalUnits.newTitle') | translate"
    >
      <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'tribalUnits.fields.type' | translate }}</span>
          <p-select
            formControlName="unitType"
            [options]="typeOptions"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'tribalUnits.fields.nameAr' | translate }} *</span>
          <input pInputText formControlName="nameAr" [attr.dir]="'rtl'" class="w-full" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'tribalUnits.fields.nameEn' | translate }} *</span>
          <input pInputText formControlName="nameEn" [attr.dir]="'ltr'" class="w-full" />
        </label>
        <div class="flex justify-end gap-2">
          <p-button
            type="button"
            [label]="'actions.cancel' | translate"
            severity="secondary"
            [text]="true"
            (onClick)="dialogOpen.set(false)"
          />
          <p-button
            type="submit"
            [label]="'actions.save' | translate"
            [loading]="saving()"
            [disabled]="form.invalid || saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
})
export class TribalUnitsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TribalUnitService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);
  readonly lang = inject(LanguageService);

  readonly canWrite = this.auth.canWrite;
  readonly units = signal<TribalUnit[]>([]);
  readonly loading = signal(false);
  readonly dialogOpen = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<TribalUnit | null>(null);

  private parentForCreate: TribalUnit | null = null;

  readonly typeOptions = (['tribe', 'branch', 'clan', 'family'] as UnitType[]).map((t) => ({
    value: t,
    label: this.i18n.instant('tribalUnits.type.' + t),
  }));

  readonly form = this.fb.nonNullable.group({
    unitType: ['tribe' as UnitType, [Validators.required]],
    nameAr: ['', [Validators.required]],
    nameEn: ['', [Validators.required]],
  });

  /** Flat list -> PrimeNG TreeNode[] keyed by parentId. */
  readonly nodes = computed<TreeNode[]>(() => {
    const list = this.units();
    const byId = new Map<string, TreeNode>();
    for (const u of list) {
      byId.set(u.id, { key: u.id, data: u, children: [], expanded: true });
    }
    const roots: TreeNode[] = [];
    for (const u of list) {
      const node = byId.get(u.id)!;
      if (u.parentId && byId.has(u.parentId)) {
        byId.get(u.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (list) => {
        this.units.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
      },
    });
  }

  childType(type: UnitType): UnitType | null {
    return CHILD_UNIT_TYPE[type];
  }

  openCreate(parent: TribalUnit | null): void {
    this.editing.set(null);
    this.parentForCreate = parent;
    const nextType: UnitType = parent ? (CHILD_UNIT_TYPE[parent.unitType] ?? 'family') : 'tribe';
    this.form.reset({ unitType: nextType, nameAr: '', nameEn: '' });
    this.dialogOpen.set(true);
  }

  openEdit(unit: TribalUnit): void {
    this.editing.set(unit);
    this.parentForCreate = null;
    this.form.reset({ unitType: unit.unitType, nameAr: unit.nameAr, nameEn: unit.nameEn });
    this.dialogOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const existing = this.editing();
    const done = {
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.messages.add({ severity: 'success', detail: this.i18n.instant('tribalUnits.saved') });
        this.reload();
      },
      error: () => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') });
      },
    };
    if (existing) {
      this.service.update(existing.id, { nameAr: value.nameAr, nameEn: value.nameEn }).subscribe(done);
    } else {
      this.service
        .create({
          parentId: this.parentForCreate?.id,
          unitType: value.unitType,
          nameAr: value.nameAr,
          nameEn: value.nameEn,
        })
        .subscribe(done);
    }
  }

  confirmDelete(unit: TribalUnit): void {
    this.confirm.confirm({
      message: this.i18n.instant('tribalUnits.deleteConfirm'),
      header: this.i18n.instant('actions.delete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.service.remove(unit.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', detail: this.i18n.instant('tribalUnits.deleted') });
            this.reload();
          },
          error: () =>
            this.messages.add({ severity: 'error', detail: this.i18n.instant('errors.generic') }),
        });
      },
    });
  }
}
